"use client";

import { useEffect, useMemo, useState } from "react";
import type { HistoryItem } from "@/lib/history";

const ACCEPTED_TYPES = [
  ".aac",
  ".mp3",
  ".mp4",
  ".m4a",
  ".mkv",
  ".mov",
  ".mpeg",
  ".mpga",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
];

const MAX_VERCEL_UPLOAD_MB = 4.5;
const MAX_VERCEL_UPLOAD_BYTES = MAX_VERCEL_UPLOAD_MB * 1024 * 1024;
const COST_PER_MINUTE_USD = 0.003;

type TranscriberProps = {
  authEnabled: boolean;
  historyEnabled: boolean;
  hasOpenAIKey: boolean;
  initialHistory: HistoryItem[];
  initialSelectedHistoryId: string | null;
  recordingStorageEnabled: boolean;
  shareStatus: string | null;
  userEmail: string | null;
};

type TranscribeResult = {
  text: string;
  model: string;
  fileName: string;
  mimeType: string;
  size: number;
  historyItem: HistoryItem | null;
};

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatUsd(amount: number) {
  if (amount < 0.01) {
    return `$${amount.toFixed(4)}`;
  }

  return `$${amount.toFixed(2)}`;
}

function getFileKind(file: File | null) {
  if (!file) {
    return null;
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  const extension = file.name.toLowerCase().split(".").at(-1);

  if (extension && ["mp4", "mov", "mkv", "webm"].includes(extension)) {
    return "video";
  }

  return "audio";
}

async function parseJson<T>(response: Response) {
  return (await response.json()) as T;
}

export function Transcriber({
  authEnabled,
  historyEnabled,
  hasOpenAIKey,
  initialHistory,
  initialSelectedHistoryId,
  recordingStorageEnabled,
  shareStatus,
  userEmail,
}: TranscriberProps) {
  const requiresGoogleSignIn = authEnabled;
  const [file, setFile] = useState<File | null>(null);
  const [detectedDurationSeconds, setDetectedDurationSeconds] = useState<
    number | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    initialSelectedHistoryId,
  );

  const shareStatusMessage = useMemo(() => {
    switch (shareStatus) {
      case "ok":
        return "Shared file received.";
      case "signin-required":
        return "Sign in before sharing files to this app.";
      case "missing-file":
        return "No shared file was received.";
      case "unsupported-file":
        return "The shared file type is not supported.";
      case "file-too-large":
        return "The shared file is too large for this deployment shape.";
      case "config-error":
        return "The app is not fully configured for shared uploads.";
      case "transcription-error":
        return "The shared file could not be transcribed.";
      default:
        return null;
    }
  }, [shareStatus]);

  const previewUrl = useMemo(() => {
    if (!file) {
      return null;
    }

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    if (!file || !previewUrl) {
      return;
    }

    let disposed = false;
    const media = document.createElement(
      getFileKind(file) === "video" ? "video" : "audio",
    );

    media.preload = "metadata";
    media.src = previewUrl;
    media.onloadedmetadata = () => {
      if (!disposed && Number.isFinite(media.duration) && media.duration > 0) {
        setDetectedDurationSeconds(media.duration);
      }
    };
    media.onerror = () => {
      if (!disposed) {
        setDetectedDurationSeconds(null);
      }
    };

    return () => {
      disposed = true;
      media.src = "";
      URL.revokeObjectURL(previewUrl);
    };
  }, [file, previewUrl]);

  const fileTooLarge = useMemo(() => {
    if (!file) {
      return false;
    }

    return file.size > MAX_VERCEL_UPLOAD_BYTES;
  }, [file]);

  const estimatedCost = useMemo(() => {
    if (!detectedDurationSeconds) {
      return null;
    }

    return (detectedDurationSeconds / 60) * COST_PER_MINUTE_USD;
  }, [detectedDurationSeconds]);

  const selectedHistoryItem = useMemo(
    () => history.find((item) => item.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId],
  );

  const activeTranscript = selectedHistoryItem ?? result?.historyItem ?? null;
  const activeText = selectedHistoryItem?.text ?? result?.text ?? "";
  const activeIsRtl =
    selectedHistoryItem?.isRtl ?? result?.historyItem?.isRtl ?? false;
  const activeRecordingUrl =
    selectedHistoryItem?.recordingUrl ?? result?.historyItem?.recordingUrl ?? null;

  const activeHistory = useMemo(
    () => history.filter((item) => !item.isArchived),
    [history],
  );

  const archivedHistory = useMemo(
    () => history.filter((item) => item.isArchived),
    [history],
  );

  useEffect(() => {
    if (!selectedHistoryId) {
      return;
    }

    let cancelled = false;

    async function refreshSelectedRecording() {
      try {
        const response = await fetch(`/api/recordings/${selectedHistoryId}`, {
          method: "GET",
        });

        const payload = await parseJson<{ item: HistoryItem } | { error: string }>(
          response,
        );

        if (!response.ok || "error" in payload || cancelled) {
          return;
        }

        setHistory((current) =>
          current.map((item) => (item.id === payload.item.id ? payload.item : item)),
        );
      } catch {
        // Leave the existing item untouched if refresh fails.
      }
    }

    void refreshSelectedRecording();

    return () => {
      cancelled = true;
    };
  }, [selectedHistoryId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requiresGoogleSignIn && !userEmail) {
      setError("Sign in with Google to transcribe files.");
      return;
    }

    if (!file) {
      setError("Choose a file first.");
      return;
    }

    if (fileTooLarge) {
      setError(
        `This simple Vercel setup only supports files up to ${MAX_VERCEL_UPLOAD_MB} MB.`,
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const payload = await parseJson<TranscribeResult | { error: string }>(
        response,
      );

      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload ? payload.error : "Transcription failed.",
        );
      }

      setResult(payload);

      if (payload.historyItem) {
        setHistory((current) => [
          payload.historyItem!,
          ...current.filter((item) => item.id !== payload.historyItem!.id),
        ]);
        setSelectedHistoryId(payload.historyItem.id);
      } else {
        setSelectedHistoryId(null);
      }
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : "Transcription failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function updateArchiveState(id: string, archived: boolean) {
    const confirmed = window.confirm(
      archived
        ? "Archive this recording?"
        : "Unarchive this recording?",
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived }),
      });

      const payload = await parseJson<{ item: HistoryItem } | { error: string }>(
        response,
      );

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Update failed.");
      }

      setHistory((current) =>
        current.map((item) => (item.id === payload.item.id ? payload.item : item)),
      );
    } catch (responseError) {
      setError(
        responseError instanceof Error ? responseError.message : "Update failed.",
      );
    }
  }

  async function deleteRecording(id: string) {
    const confirmed = window.confirm(
      "Delete this recording and transcript permanently?",
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: "DELETE",
      });

      const payload = await parseJson<{ id: string } | { error: string }>(response);

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Delete failed.");
      }

      setHistory((current) => {
        const nextHistory = current.filter((item) => item.id !== payload.id);

        if (selectedHistoryId === payload.id) {
          setSelectedHistoryId(nextHistory[0]?.id ?? null);
        }

        return nextHistory;
      });
    } catch (responseError) {
      setError(
        responseError instanceof Error ? responseError.message : "Delete failed.",
      );
    }
  }

  function renderHistoryList(items: HistoryItem[]) {
    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-[1.25rem] border p-4 transition ${
              item.id === selectedHistoryId
                ? "border-stone-900 bg-stone-100"
                : "border-stone-900/10 bg-stone-50 hover:bg-stone-100"
            }`}
          >
            <button
              className="block w-full text-left"
              onClick={() => {
                setSelectedHistoryId(item.id);
                setResult(null);
              }}
              type="button"
            >
              <div className="mb-2 flex flex-col gap-1 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-stone-900">{item.fileName}</p>
                <p>{formatDate(item.createdAt)}</p>
              </div>
              <p className="mb-3 text-xs text-stone-500">
                {item.model} · {formatBytes(item.size)}
              </p>
              <p
                className={`line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-stone-700 ${
                  item.isRtl ? "text-right" : "text-left"
                }`}
                dir={item.isRtl ? "rtl" : "ltr"}
              >
                {item.text}
              </p>
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-full border border-stone-900/10 px-3 py-1.5 text-xs text-stone-700 transition hover:bg-white"
                onClick={() => updateArchiveState(item.id, !item.isArchived)}
                type="button"
              >
                {item.isArchived ? "Unarchive" : "Archive"}
              </button>
              <button
                className="rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-50"
                onClick={() => deleteRecording(item.id)}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.22em] text-stone-500">
            Upload to transcript
          </p>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-stone-950">
            Transcribe
          </h1>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          {authEnabled ? (
            userEmail ? (
              <>
                <p className="text-sm text-stone-500">{userEmail}</p>
                <a
                  className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-900 hover:text-stone-50"
                  href="/auth/logout"
                >
                  Sign out
                </a>
              </>
            ) : (
              <a
                className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-900 hover:text-stone-50"
                href="/auth/login"
              >
                Sign in with Google
              </a>
            )
          ) : (
            <p className="max-w-xs text-right text-sm text-stone-500">
              Google sign-in appears automatically after Supabase envs are set.
            </p>
          )}
        </div>
      </header>

      {shareStatusMessage ? (
        <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          {shareStatusMessage}
        </div>
      ) : null}

      <div className="rounded-[1.5rem] border border-stone-900/10 bg-stone-50/70 p-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-3">
            <span className="text-sm text-stone-600">Audio or video file</span>
            <input
              accept={ACCEPTED_TYPES.join(",")}
              className="block w-full rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-sm text-stone-700 file:mr-3 file:rounded-full file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-stone-50"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);
                setError(null);
                setResult(null);
              }}
              type="file"
            />
          </label>

          <div className="space-y-1 text-sm text-stone-500">
            <p>Supported: {ACCEPTED_TYPES.join(", ")}</p>
            <p>Language: auto-detect</p>
            <p>Model: gpt-4o-mini-transcribe</p>
            <p>Base price: about $0.003 per minute</p>
            <p>Unsupported containers are converted to WAV automatically.</p>
            <p>Vercel-safe file size in this setup: up to 4.5 MB</p>
            {detectedDurationSeconds ? (
              <p>
                This file looks like {formatDuration(detectedDurationSeconds)}.
                Estimated transcription cost: {formatUsd(estimatedCost ?? 0)}.
              </p>
            ) : null}
          </div>

          {file ? (
            <div className="space-y-3 rounded-2xl bg-white px-4 py-3 text-sm text-stone-600">
              <div>
                <p className="font-medium text-stone-900">{file.name}</p>
                <p>{formatBytes(file.size)}</p>
                {fileTooLarge ? (
                  <p className="mt-2 text-amber-700">
                    Too large for a direct Vercel Function upload in this simple
                    version.
                  </p>
                ) : null}
              </div>
              {previewUrl ? (
                getFileKind(file) === "video" ? (
                  <video
                    className="max-h-64 w-full rounded-xl bg-black"
                    controls
                    preload="metadata"
                    src={previewUrl}
                  />
                ) : (
                  <audio
                    className="w-full"
                    controls
                    preload="metadata"
                    src={previewUrl}
                  />
                )
              ) : null}
            </div>
          ) : null}

          {!hasOpenAIKey ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Add `OPENAI_API_KEY` to `.env.local` to enable uploads.
            </div>
          ) : null}

          {requiresGoogleSignIn && !userEmail ? (
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
              Sign in with Google before uploading or transcribing.
            </div>
          ) : null}

          {authEnabled && !historyEnabled ? (
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
              Add `DATABASE_URL` to enable saved history.
            </div>
          ) : null}

          {!recordingStorageEnabled ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Recording storage is not configured. New transcripts will save
              text history, but uploaded files will not be playable later until
              `SUPABASE_SECRET_KEY` is added and the app is restarted.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-stone-900 px-5 text-sm font-medium text-stone-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
            disabled={
              !hasOpenAIKey ||
              !file ||
              fileTooLarge ||
              submitting ||
              (requiresGoogleSignIn && !userEmail)
            }
            type="submit"
          >
            {submitting ? "Transcribing..." : "Transcribe"}
          </button>
        </form>
      </div>

      <section className="flex flex-1 rounded-[1.5rem] border border-stone-900/10 bg-white p-4 sm:p-5">
        {activeTranscript || result ? (
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-1 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
              <p>{activeTranscript?.fileName ?? result?.fileName}</p>
              <p>{activeTranscript?.model ?? result?.model}</p>
            </div>
            {activeRecordingUrl ? (
              activeTranscript?.mimeType.startsWith("video/") ? (
                <video
                  className="max-h-72 w-full rounded-xl bg-black"
                  controls
                  preload="metadata"
                  src={activeRecordingUrl}
                />
              ) : (
                <audio
                  className="w-full"
                  controls
                  preload="metadata"
                  src={activeRecordingUrl}
                />
              )
            ) : null}
            <textarea
              className={`min-h-[18rem] w-full resize-y rounded-[1.25rem] border border-stone-900/10 bg-stone-50 p-4 text-sm leading-7 text-stone-800 outline-none ${
                activeIsRtl ? "text-right" : "text-left"
              }`}
              dir={activeIsRtl ? "rtl" : "ltr"}
              readOnly
              value={activeText}
            />
          </div>
        ) : (
          <div className="flex min-h-[18rem] w-full items-center justify-center rounded-[1.25rem] border border-dashed border-stone-200 bg-stone-50/70 px-4 text-center text-sm text-stone-500">
            Transcript appears here.
          </div>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-stone-900/10 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-stone-950">
            History
          </h2>
          <p className="text-sm text-stone-500">
            {userEmail ? `${activeHistory.length} active` : "Sign in required"}
          </p>
        </div>

        {activeHistory.length > 0 ? (
          renderHistoryList(activeHistory)
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-stone-200 bg-stone-50/70 px-4 py-8 text-center text-sm text-stone-500">
            {userEmail
              ? "No saved transcripts yet."
              : "Sign in with Google to persist transcript history."}
          </div>
        )}

        {archivedHistory.length > 0 ? (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm uppercase tracking-[0.18em] text-stone-500">
                Archived
              </h3>
              <p className="text-sm text-stone-500">{archivedHistory.length}</p>
            </div>
            {renderHistoryList(archivedHistory)}
          </div>
        ) : null}
      </section>
    </section>
  );
}
