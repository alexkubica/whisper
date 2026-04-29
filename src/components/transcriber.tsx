"use client";

import type { HistoryItem } from "@/lib/history";
import type { Locale } from "@/lib/locale";
import Link from "next/link";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

type TranscriberProps = {
  authEnabled: boolean;
  historyEnabled: boolean;
  hasOpenAIKey: boolean;
  initialHistory: HistoryItem[];
  initialSelectedHistoryId: string | null;
  locale: Locale;
  recordingStorageEnabled: boolean;
  shareStatus: string | null;
  userEmail: string | null;
};

type CreateJobResponse = {
  item: HistoryItem;
  upload: {
    path: string;
    signedUrl: string;
    token: string;
  };
};

type JobResponse = {
  item: HistoryItem;
};

type JobsResponse = {
  items: HistoryItem[];
};

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getFileKind(file: { name: string; type: string } | null) {
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

function isTerminalStatus(status: string) {
  return status === "completed" || status === "failed";
}

async function parseJson<T>(response: Response) {
  return (await response.json()) as T;
}

function uploadFileToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    request.addEventListener("error", () => {
      reject(new Error("Upload failed."));
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error("Upload failed."));
    });

    const formData = new FormData();
    formData.append("cacheControl", "3600");
    formData.append("", file);
    request.send(formData);
  });
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <rect
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
        width="11"
        x="9"
        y="9"
      />
      <path
        d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 transition ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

const copy = {
  en: {
    shareStatus: {
      ok: "Shared file queued.",
      "signin-required": "Sign in to open shared files.",
      "missing-file": "No file was shared.",
      "unsupported-file": "That file could not be opened.",
      "file-too-large": "That shared file is too large. Open the app to upload it there.",
      "config-error": "Uploads are not ready yet.",
      "transcription-error": "That file could not be transcribed.",
    },
    copyFailed: "Copy failed.",
    copySuccess: "Transcript copied.",
    signInToTranscribe: "Sign in to transcribe.",
    chooseFile: "Choose a file.",
    transcribeFailed: "Transcription failed.",
    deletePrompt: "Delete this transcript?",
    deleteFailed: "Delete failed.",
    title: "Turn a voice note into text",
    signOut: "Sign out",
    signIn: "Sign in",
    signInNotConfigured: "Sign-in is not configured yet.",
    upload: "Upload",
    uploadHint: "Audio or video, kept for playback, audio extracted for transcription.",
    pickFile: "Pick audio or video",
    clearFile: "Remove file",
    uploadsNotReady: "Uploads are not configured yet.",
    signInBeforeUploading: "Sign in before uploading.",
    playbackNotSaved: "Playback storage is not configured yet.",
    working: "Starting...",
    uploading: "Uploading...",
    transcribe: "Upload and transcribe",
    transcript: "Transcript",
    transcriptPlaceholder: "Your transcript will appear here.",
    copyTranscript: "Copy transcript",
    copied: "Copied",
    addFileToSeeTranscript: "Choose a file or open a recent job.",
    recent: "Recent",
    recentHintSignedIn: "Completed and in-flight jobs stay here.",
    recentHintSignedOut: "Sign in to save transcripts.",
    recentPreviewPlaceholder: "Choose a recent transcript to view it here.",
    noTranscripts: "No transcripts yet.",
    signInToKeepHistory: "Sign in to keep history.",
    delete: "Delete",
    queuedNotice: "Upload finished. Processing in the background.",
    statusTitle: "Status",
    statusHint: "This job keeps running after the page changes.",
    statusLabels: {
      uploading: "Uploading",
      queued: "Queued",
      extracting: "Extracting audio",
      transcribing: "Transcribing",
      completed: "Completed",
      failed: "Failed",
    },
  },
  he: {
    shareStatus: {
      ok: "הקובץ המשותף נכנס לתור.",
      "signin-required": "צריך להתחבר כדי לפתוח קבצים משותפים.",
      "missing-file": "לא התקבל קובץ.",
      "unsupported-file": "לא הצלחנו לפתוח את הקובץ הזה.",
      "file-too-large": "הקובץ המשותף גדול מדי. פתחו את האפליקציה והעלו משם.",
      "config-error": "העלאות עדיין לא מוגדרות.",
      "transcription-error": "לא הצלחנו לתמלל את הקובץ הזה.",
    },
    copyFailed: "ההעתקה נכשלה.",
    copySuccess: "התמלול הועתק.",
    signInToTranscribe: "צריך להתחבר כדי לתמלל.",
    chooseFile: "בחרו קובץ.",
    transcribeFailed: "התמלול נכשל.",
    deletePrompt: "למחוק את התמלול הזה?",
    deleteFailed: "המחיקה נכשלה.",
    title: "הופכים הודעה קולית לטקסט",
    signOut: "להתנתק",
    signIn: "התחברות",
    signInNotConfigured: "התחברות עדיין לא מוגדרת.",
    upload: "העלאה",
    uploadHint: "אודיו או וידאו נשמרים לניגון, והאודיו נשלף לתמלול.",
    pickFile: "בחירת אודיו או וידאו",
    clearFile: "הסרת קובץ",
    uploadsNotReady: "העלאות עדיין לא מוגדרות.",
    signInBeforeUploading: "צריך להתחבר לפני שמעלים.",
    playbackNotSaved: "אחסון לניגון עדיין לא מוגדר.",
    working: "מתחיל...",
    uploading: "מעלה...",
    transcribe: "להעלות ולתמלל",
    transcript: "תמלול",
    transcriptPlaceholder: "התמלול יופיע כאן.",
    copyTranscript: "העתקת תמלול",
    copied: "הועתק",
    addFileToSeeTranscript: "בחרו קובץ או פתחו עבודה אחרונה.",
    recent: "אחרונים",
    recentHintSignedIn: "גם עבודות בתהליך נשארות כאן.",
    recentHintSignedOut: "התחברו כדי לשמור תמלולים.",
    recentPreviewPlaceholder: "בחרו תמלול אחרון כדי לראות אותו כאן.",
    noTranscripts: "עדיין אין תמלולים.",
    signInToKeepHistory: "התחברו כדי לשמור היסטוריה.",
    delete: "מחיקה",
    queuedNotice: "ההעלאה הסתיימה. העיבוד ממשיך ברקע.",
    statusTitle: "סטטוס",
    statusHint: "העבודה ממשיכה גם אם מרעננים או עוברים עמוד.",
    statusLabels: {
      uploading: "מעלה",
      queued: "בתור",
      extracting: "מחלץ אודיו",
      transcribing: "מתמלל",
      completed: "הושלם",
      failed: "נכשל",
    },
  },
} as const;

export function Transcriber({
  authEnabled,
  historyEnabled,
  hasOpenAIKey,
  initialHistory,
  initialSelectedHistoryId,
  locale,
  recordingStorageEnabled,
  shareStatus,
  userEmail,
}: TranscriberProps) {
  const requiresGoogleSignIn = authEnabled;
  const t = copy[locale];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    initialSelectedHistoryId,
  );
  const [copyState, setCopyState] = useState<string | null>(null);
  const [overflowingHistoryIds, setOverflowingHistoryIds] = useState<
    Record<string, boolean>
  >({});
  const [activeUploadJobId, setActiveUploadJobId] = useState<string | null>(null);
  const [activeUploadProgress, setActiveUploadProgress] = useState<number | null>(
    null,
  );
  const historyPreviewRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const shareStatusMessage = useMemo(() => {
    return shareStatus
      ? t.shareStatus[shareStatus as keyof typeof t.shareStatus] ?? null
      : null;
  }, [shareStatus, t]);

  const previewUrl = useMemo(() => {
    if (!file) {
      return null;
    }

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectedHistoryItem = useMemo(
    () => history.find((item) => item.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId],
  );

  const hasPendingJobs = history.some((item) => !isTerminalStatus(item.status));
  const currentText = selectedHistoryItem?.text ?? "";
  const currentIsRtl = selectedHistoryItem?.isRtl ?? false;
  const currentRecordingUrl =
    selectedHistoryItem?.recordingUrl ??
    (selectedHistoryId === activeUploadJobId ? previewUrl : null);
  const currentFileName =
    selectedHistoryItem?.fileName ?? file?.name ?? t.transcript;
  const currentMimeType =
    selectedHistoryItem?.mimeType ?? file?.type ?? "application/octet-stream";
  const currentStatus = selectedHistoryItem?.status ?? null;
  const currentProgress =
    selectedHistoryItem?.id === activeUploadJobId &&
    activeUploadProgress !== null &&
    selectedHistoryItem?.status === "uploading"
      ? activeUploadProgress
      : selectedHistoryItem?.progress ?? null;
  const currentError = selectedHistoryItem?.errorMessage ?? null;

  useEffect(() => {
    if (!copyState) {
      return;
    }

    const timeout = window.setTimeout(() => setCopyState(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  useEffect(() => {
    function updateOverflowState() {
      setOverflowingHistoryIds((current) => {
        const next = { ...current };
        let changed = false;

        for (const item of history) {
          const element = historyPreviewRefs.current[item.id];
          const isOverflowing = element
            ? element.scrollHeight > element.clientHeight + 1
            : false;

          if (next[item.id] !== isOverflowing) {
            next[item.id] = isOverflowing;
            changed = true;
          }
        }

        return changed ? next : current;
      });
    }

    updateOverflowState();
    window.addEventListener("resize", updateOverflowState);

    return () => {
      window.removeEventListener("resize", updateOverflowState);
    };
  }, [history]);

  useEffect(() => {
    if (!userEmail || !hasPendingJobs || activeUploadJobId) {
      return;
    }

    let cancelled = false;

    async function refreshJobs() {
      try {
        const response = await fetch("/api/transcriptions");
        const payload = await parseJson<JobsResponse | { error: string }>(response);

        if (!response.ok || "error" in payload || cancelled) {
          return;
        }

        startTransition(() => {
          setHistory(payload.items);
        });

        if (
          selectedHistoryId &&
          !payload.items.some((item) => item.id === selectedHistoryId)
        ) {
          setSelectedHistoryId(null);
        }
      } catch {
        // Keep current UI state if polling fails.
      }
    }

    void refreshJobs();
    const interval = window.setInterval(() => {
      void refreshJobs();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeUploadJobId, hasPendingJobs, selectedHistoryId, userEmail]);

  function handlePickedFile(nextFile: File | null) {
    setFile(nextFile);
    setError(null);
    setNotice(null);
  }

  function clearPickedFile() {
    setFile(null);
    setError(null);
    setNotice(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetPickedFile() {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(key);
      setError(null);
      setNotice(t.copySuccess);
    } catch {
      setError(t.copyFailed);
    }
  }

  function updateHistoryItem(itemId: string, updater: (item: HistoryItem) => HistoryItem) {
    setHistory((current) =>
      current.map((item) => (item.id === itemId ? updater(item) : item)),
    );
  }

  function statusLabel(status: string) {
    return (
      t.statusLabels[status as keyof typeof t.statusLabels] ??
      t.statusLabels.queued
    );
  }

  function statusTone(status: string) {
    if (status === "completed") {
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    }

    if (status === "failed") {
      return "border-rose-200 bg-rose-50 text-rose-800";
    }

    return "border-sky-200 bg-sky-50 text-sky-900";
  }

  function historyPreview(item: HistoryItem) {
    if (item.status === "failed") {
      return item.errorMessage ?? statusLabel(item.status);
    }

    if (item.status !== "completed") {
      return `${statusLabel(item.status)}${
        item.progress > 0 ? ` · ${item.progress}%` : ""
      }`;
    }

    return item.text;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requiresGoogleSignIn && !userEmail) {
      setError(t.signInToTranscribe);
      setNotice(null);
      return;
    }

    if (!file) {
      setError(t.chooseFile);
      setNotice(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    let createdJobId: string | null = null;

    try {
      const createResponse = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });

      const createPayload = await parseJson<
        CreateJobResponse | { error: string }
      >(createResponse);

      if (!createResponse.ok || "error" in createPayload) {
        throw new Error(
          "error" in createPayload ? createPayload.error : t.transcribeFailed,
        );
      }

      createdJobId = createPayload.item.id;
      setActiveUploadJobId(createdJobId);
      setActiveUploadProgress(0);
      setSelectedHistoryId(createdJobId);
      setHistory((current) => [
        createPayload.item,
        ...current.filter((item) => item.id !== createPayload.item.id),
      ]);

      await uploadFileToSignedUrl(createPayload.upload.signedUrl, file, (progress) => {
        setActiveUploadProgress(progress);
        updateHistoryItem(createdJobId!, (item) => ({
          ...item,
          progress,
          status: "uploading",
        }));
      });

      const processResponse = await fetch(`/api/transcribe/${createdJobId}/process`, {
        method: "POST",
      });

      const processPayload = await parseJson<JobResponse | { error: string }>(
        processResponse,
      );

      if (!processResponse.ok || "error" in processPayload) {
        throw new Error(
          "error" in processPayload ? processPayload.error : t.transcribeFailed,
        );
      }

      updateHistoryItem(createdJobId, () => processPayload.item);
      setActiveUploadJobId(null);
      setActiveUploadProgress(null);
      setNotice(t.queuedNotice);
      resetPickedFile();
    } catch (responseError) {
      if (createdJobId) {
        try {
          await fetch(`/api/recordings/${createdJobId}`, {
            method: "DELETE",
          });
        } catch {
          // Keep the cleanup best-effort.
        }

        setHistory((current) => current.filter((item) => item.id !== createdJobId));

        if (selectedHistoryId === createdJobId) {
          setSelectedHistoryId(null);
        }
      }

      setActiveUploadJobId(null);
      setActiveUploadProgress(null);
      setError(
        responseError instanceof Error ? responseError.message : t.transcribeFailed,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRecording(itemId: string) {
    const confirmed = window.confirm(t.deletePrompt);

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/recordings/${itemId}`, {
        method: "DELETE",
      });

      const payload = await parseJson<{ id: string } | { error: string }>(response);

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : t.deleteFailed);
      }

      setHistory((current) => current.filter((item) => item.id !== itemId));
      if (selectedHistoryId === itemId) {
        setSelectedHistoryId(null);
      }
    } catch {
      setError(t.deleteFailed);
    }
  }

  function toggleHistoryItem(itemId: string, canExpand: boolean) {
    if (!canExpand) {
      return;
    }

    setSelectedHistoryId((current) => (current === itemId ? null : itemId));
  }

  return (
    <section className="flex flex-1 flex-col gap-6 lg:gap-8">
      <header className="grid items-start gap-5 rounded-[1.75rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(239,245,255,0.82))] p-5 shadow-[0_18px_60px_rgba(76,101,151,0.08)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 self-start">
          <Link className="text-sm font-medium tracking-[0.22em] text-slate-500" href="/">
            Miluli
          </Link>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.07em] text-slate-950 sm:text-5xl">
            {t.title}
          </h1>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <div className="flex items-center rounded-full border border-slate-200 bg-white/70 p-1">
            <a
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                locale === "en" ? "bg-slate-950 text-white" : "text-slate-600"
              }`}
              href="/api/locale?locale=en&redirectTo=%2Fapp"
            >
              EN
            </a>
            <a
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                locale === "he" ? "bg-slate-950 text-white" : "text-slate-600"
              }`}
              href="/api/locale?locale=he&redirectTo=%2Fapp"
            >
              HE
            </a>
          </div>
          {authEnabled ? (
            userEmail ? (
              <>
                <p className="text-sm text-slate-500">{userEmail}</p>
                <a
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  href="/auth/logout"
                >
                  {t.signOut}
                </a>
              </>
            ) : (
              <a
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                href="/auth/login?next=/app"
              >
                {t.signIn}
              </a>
            )
          ) : (
            <p className="text-sm text-slate-500">{t.signInNotConfigured}</p>
          )}
        </div>
      </header>

      {shareStatusMessage ? (
        <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {shareStatusMessage}
        </div>
      ) : null}

      <div className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/78 p-5 shadow-[0_18px_60px_rgba(76,101,151,0.08)] sm:p-6">
          <form className="flex h-full flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.05em] text-slate-950">
                  {t.upload}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{t.uploadHint}</p>
              </div>
            </div>

            <input
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={(event) => handlePickedFile(event.target.files?.[0] ?? null)}
              ref={fileInputRef}
              type="file"
            />

            {file ? (
              <div className="flex min-h-56 flex-1 flex-col rounded-[1.75rem] border border-slate-200 bg-slate-50/90 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-950">{file.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    aria-label={t.clearFile}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={clearPickedFile}
                    title={t.clearFile}
                    type="button"
                  >
                    <CloseIcon />
                  </button>
                </div>
                {previewUrl ? (
                  <div className="mt-4 flex-1">
                    {getFileKind(file) === "video" ? (
                      <video
                        className="h-full max-h-64 w-full rounded-[1.25rem] bg-slate-950"
                        controls
                        preload="metadata"
                        src={previewUrl}
                      />
                    ) : (
                      <audio className="w-full" controls preload="metadata" src={previewUrl} />
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                className="group flex min-h-56 flex-1 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300 bg-[linear-gradient(180deg,#f8fbff_0%,#f2f6ff_100%)] px-6 text-center transition hover:border-slate-400 hover:bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8ff_100%)]"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <p className="text-lg font-medium tracking-[-0.04em] text-slate-900">
                  {t.pickFile}
                </p>
              </button>
            )}

            {!hasOpenAIKey || !historyEnabled ? (
              <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t.uploadsNotReady}
              </div>
            ) : null}

            {requiresGoogleSignIn && !userEmail ? (
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {t.signInBeforeUploading}
              </div>
            ) : null}

            {!recordingStorageEnabled && historyEnabled ? (
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {t.playbackNotSaved}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                {notice}
              </div>
            ) : null}

            <button
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={
                !hasOpenAIKey ||
                !historyEnabled ||
                !file ||
                submitting ||
                (requiresGoogleSignIn && !userEmail)
              }
              type="submit"
            >
              {activeUploadProgress !== null
                ? `${t.uploading} ${activeUploadProgress}%`
                : submitting
                  ? t.working
                  : t.transcribe}
            </button>
          </form>
        </section>

        <section className="flex min-h-[30rem] flex-col rounded-[1.75rem] border border-white/70 bg-white/78 p-5 shadow-[0_18px_60px_rgba(76,101,151,0.08)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.05em] text-slate-950">
                {t.transcript}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedHistoryItem ? currentFileName : t.transcriptPlaceholder}
              </p>
            </div>
            {currentText ? (
              <button
                aria-label={t.copyTranscript}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => copyText("active", currentText)}
                title={copyState === "active" ? t.copied : t.copyTranscript}
                type="button"
              >
                <CopyIcon />
              </button>
            ) : null}
          </div>

          {currentRecordingUrl ? (
            <div className="mt-5">
              {currentMimeType.startsWith("video/") ? (
                <video
                  className="max-h-72 w-full rounded-[1.25rem] bg-slate-950"
                  controls
                  preload="metadata"
                  src={currentRecordingUrl}
                />
              ) : (
                <audio className="w-full" controls preload="metadata" src={currentRecordingUrl} />
              )}
            </div>
          ) : null}

          {selectedHistoryItem && currentStatus !== "completed" ? (
            <div className="mt-5 flex flex-1 flex-col justify-center rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#fcfdff_0%,#f5f8ff_100%)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-950">{t.statusTitle}</p>
                  <p className="mt-1 text-sm text-slate-500">{t.statusHint}</p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(
                    currentStatus!,
                  )}`}
                >
                  {statusLabel(currentStatus!)}
                </span>
              </div>
              {currentProgress !== null ? (
                <>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all ${
                        currentStatus === "failed" ? "bg-rose-400" : "bg-slate-950"
                      }`}
                      style={{ width: `${Math.max(8, currentProgress)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-500">{currentProgress}%</p>
                </>
              ) : null}
              {currentError ? (
                <p className="mt-4 text-sm leading-7 text-rose-700">{currentError}</p>
              ) : null}
            </div>
          ) : currentText ? (
            <div className="mt-5 flex-1 rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#fcfdff_0%,#f5f8ff_100%)] p-1">
              <textarea
                className={`min-h-[22rem] w-full resize-none rounded-[1.25rem] bg-transparent px-4 py-4 text-sm leading-8 text-slate-800 outline-none sm:text-[15px] ${
                  currentIsRtl ? "text-right" : "text-left"
                }`}
                dir={currentIsRtl ? "rtl" : "ltr"}
                readOnly
                value={currentText}
              />
            </div>
          ) : (
            <div className="mt-5 flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f4f7ff_100%)] px-6 text-center text-sm leading-7 text-slate-500">
              {t.addFileToSeeTranscript}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/78 p-5 shadow-[0_18px_60px_rgba(76,101,151,0.08)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.05em] text-slate-950">
              {t.recent}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {userEmail ? t.recentHintSignedIn : t.recentHintSignedOut}
            </p>
          </div>
          {userEmail ? (
            <p className="text-sm text-slate-400">{history.length}</p>
          ) : null}
        </div>

        {history.length > 0 ? (
          <div className="mt-5 grid gap-3">
            {history.map((item) => {
              const canExpand =
                item.status === "completed" && (overflowingHistoryIds[item.id] ?? false);
              const isOpen = item.id === selectedHistoryId;

              return (
                <article
                  key={item.id}
                  className={`min-w-0 rounded-[1.5rem] border p-4 transition ${
                    isOpen
                      ? "border-sky-300 bg-[linear-gradient(180deg,#f3f8ff_0%,#eaf2ff_100%)] text-slate-950 shadow-[0_14px_40px_rgba(56,95,173,0.14)]"
                      : "border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelectedHistoryId(item.id)}
                      type="button"
                    >
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{item.fileName}</p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone(
                            item.status,
                          )}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(item.createdAt, locale)} · {formatBytes(item.size)}
                      </p>
                    </button>
                    <div className="shrink-0 flex items-center gap-2">
                      {canExpand ? (
                        <button
                          aria-label={isOpen ? "Collapse transcript" : "Expand transcript"}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                            isOpen
                              ? "border-sky-200 bg-white/75 text-slate-700 hover:bg-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            toggleHistoryItem(item.id, true);
                          }}
                          type="button"
                        >
                          <ChevronIcon open={isOpen} />
                        </button>
                      ) : null}
                      {item.text ? (
                        <button
                          aria-label={`${t.copyTranscript} ${item.fileName}`}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                            isOpen
                              ? "border-sky-200 bg-white/75 text-slate-700 hover:bg-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                          onClick={() => copyText(item.id, item.text)}
                          title={copyState === item.id ? t.copied : t.copyTranscript}
                          type="button"
                        >
                          <CopyIcon />
                        </button>
                      ) : null}
                      <button
                        aria-label={`${t.delete} ${item.fileName}`}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                          isOpen
                            ? "border-sky-200 bg-white/75 text-slate-700 hover:bg-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                        onClick={() => void deleteRecording(item.id)}
                        title={t.delete}
                        type="button"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  {item.recordingUrl ? (
                    <div className="mt-4">
                      {item.mimeType.startsWith("video/") ? (
                        <video
                          className="max-h-72 w-full rounded-[1.25rem] bg-slate-950"
                          controls
                          preload="metadata"
                          src={item.recordingUrl}
                        />
                      ) : (
                        <audio
                          className="w-full"
                          controls
                          preload="metadata"
                          src={item.recordingUrl}
                        />
                      )}
                    </div>
                  ) : null}

                  <button
                    className={`mt-4 block w-full min-w-0 text-left text-sm leading-7 ${
                      isOpen ? "text-slate-700" : "text-slate-600"
                    }`}
                    dir={item.isRtl ? "rtl" : "ltr"}
                    onClick={() => {
                      if (item.status === "completed") {
                        toggleHistoryItem(item.id, canExpand);
                      } else {
                        setSelectedHistoryId(item.id);
                      }
                    }}
                    type="button"
                  >
                    {isOpen && item.status === "completed" ? (
                      <div className="max-h-80 overflow-x-hidden overflow-y-auto break-words whitespace-pre-wrap">
                        {item.text}
                      </div>
                    ) : (
                      <span
                        className={`break-words whitespace-pre-wrap ${
                          item.status === "completed" && canExpand ? "line-clamp-4" : ""
                        }`}
                        ref={(element) => {
                          historyPreviewRefs.current[item.id] = element;
                        }}
                      >
                        {historyPreview(item)}
                      </span>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f4f7ff_100%)] px-4 py-10 text-center text-sm text-slate-500">
            {userEmail ? t.noTranscripts : t.signInToKeepHistory}
          </div>
        )}
      </section>
    </section>
  );
}
