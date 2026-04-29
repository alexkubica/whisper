"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HistoryItem } from "@/lib/history";
import type { Locale } from "@/lib/locale";

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

type TranscribeResult = {
  text: string;
  fileName: string;
  mimeType: string;
  size: number;
  historyItem: HistoryItem | null;
};

type ClipboardWithRead = Clipboard & {
  read?: () => Promise<ClipboardItem[]>;
};

function extractClipboardFile(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return null;
  }

  for (const file of Array.from(dataTransfer.files)) {
    if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
      return file;
    }
  }

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== "file") {
      continue;
    }

    const file = item.getAsFile();

    if (file && (file.type.startsWith("audio/") || file.type.startsWith("video/"))) {
      return file;
    }
  }

  return null;
}

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

function PasteIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M9 4h6m-5 0a1 1 0 0 0-1 1v1h6V5a1 1 0 0 0-1-1m-4 0h4m-8 4h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"
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
      ok: "Shared file received.",
      "signin-required": "Sign in to open shared files.",
      "missing-file": "No file was shared.",
      "unsupported-file": "That file could not be opened.",
      "file-too-large": "That file is too large to upload here.",
      "config-error": "Uploads are not ready yet.",
      "transcription-error": "That file could not be transcribed.",
    },
    copyFailed: "Copy failed.",
    signInToTranscribe: "Sign in to transcribe.",
    chooseOrPaste: "Choose or paste a file.",
    fileTooLarge: `Files over ${MAX_VERCEL_UPLOAD_MB}MB cannot be uploaded here.`,
    transcribeFailed: "Transcription failed.",
    deletePrompt: "Delete this transcript?",
    deleteFailed: "Delete failed.",
    title: "Turn a voice note into text.",
    intro:
      "Choose a file or paste one from the clipboard. The transcript appears here. If something breaks, you’ll see the error.",
    signOut: "Sign out",
    signIn: "Sign in",
    signInNotConfigured: "Sign-in is not configured yet.",
    upload: "Upload",
    uploadHint: "Audio or video, straight from your device or clipboard.",
    chooseFile: "Choose file",
    pasteFile: "Paste file",
    uploadBadge: "Add file",
    uploadTitle: "Choose a file or paste one.",
    uploadBody: "Shorter uploads work best in this version.",
    pasteHint: "Paste now with Ctrl+V or Cmd+V. On mobile, long press and paste.",
    fileNotFoundInPaste: "No audio or video file was found to paste.",
    tooLargeBadge: "Too large",
    uploadsNotReady: "Uploads are not configured yet.",
    signInBeforeUploading: "Sign in before uploading.",
    playbackNotSaved: "Transcription works, but file playback is not saved yet.",
    working: "Working...",
    transcribe: "Transcribe",
    transcript: "Transcript",
    transcriptPlaceholder: "Your text will appear here.",
    copyTranscript: "Copy transcript",
    copied: "Copied",
    addFileToSeeTranscript: "Add a file to see the transcript.",
    recent: "Recent",
    recentHintSignedIn: "Your latest transcripts.",
    recentHintSignedOut: "Sign in to save transcripts.",
    delete: "Delete",
    noTranscripts: "No transcripts yet.",
    signInToKeepHistory: "Sign in to keep history.",
  },
  he: {
    shareStatus: {
      ok: "הקובץ המשותף התקבל.",
      "signin-required": "צריך להתחבר כדי לפתוח קבצים משותפים.",
      "missing-file": "לא התקבל קובץ.",
      "unsupported-file": "לא הצלחנו לפתוח את הקובץ הזה.",
      "file-too-large": "הקובץ גדול מדי להעלאה כאן.",
      "config-error": "העלאות עדיין לא מוגדרות.",
      "transcription-error": "לא הצלחנו לתמלל את הקובץ הזה.",
    },
    copyFailed: "ההעתקה נכשלה.",
    signInToTranscribe: "צריך להתחבר כדי לתמלל.",
    chooseOrPaste: "בחרו קובץ או הדביקו קובץ.",
    fileTooLarge: `אי אפשר להעלות כאן קבצים מעל ${MAX_VERCEL_UPLOAD_MB}MB.`,
    transcribeFailed: "התמלול נכשל.",
    deletePrompt: "למחוק את התמלול הזה?",
    deleteFailed: "המחיקה נכשלה.",
    title: "הופכים הודעה קולית לטקסט.",
    intro:
      "בוחרים קובץ או מדביקים מהלוח. התמלול מופיע כאן. אם משהו נשבר, תראו שגיאה ולא טקסט מיותר.",
    signOut: "התנתקות",
    signIn: "התחברות",
    signInNotConfigured: "התחברות עדיין לא מוגדרת.",
    upload: "העלאה",
    uploadHint: "אודיו או וידאו, ישר מהמכשיר או מהלוח.",
    chooseFile: "לבחור קובץ",
    pasteFile: "הדבקת קובץ",
    uploadBadge: "להוסיף קובץ",
    uploadTitle: "בחרו קובץ או הדביקו קובץ.",
    uploadBody: "בגרסה הזו עדיף לעבוד עם קבצים קצרים יותר.",
    pasteHint: "עכשיו הדביקו כאן עם Ctrl+V או Cmd+V. במובייל אפשר ללחוץ לחיצה ארוכה ולהדביק.",
    fileNotFoundInPaste: "לא נמצא קובץ אודיו או וידאו להדבקה.",
    tooLargeBadge: "גדול מדי",
    uploadsNotReady: "העלאות עדיין לא מוגדרות.",
    signInBeforeUploading: "צריך להתחבר לפני שמעלים.",
    playbackNotSaved: "התמלול יעבוד, אבל שמירת הניגון של הקובץ עדיין לא מוכנה.",
    working: "מעבד...",
    transcribe: "לתמלל",
    transcript: "תמלול",
    transcriptPlaceholder: "הטקסט יופיע כאן.",
    copyTranscript: "העתקת תמלול",
    copied: "הועתק",
    addFileToSeeTranscript: "הוסיפו קובץ כדי לראות את התמלול.",
    recent: "אחרונים",
    recentHintSignedIn: "התמלולים האחרונים שלכם.",
    recentHintSignedOut: "התחברו כדי לשמור תמלולים.",
    delete: "מחיקה",
    noTranscripts: "עדיין אין תמלולים.",
    signInToKeepHistory: "התחברו כדי לשמור היסטוריה.",
  },
} satisfies Record<Locale, unknown>;

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
  const pasteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    initialSelectedHistoryId,
  );
  const [copyState, setCopyState] = useState<string | null>(null);
  const [pasteHintVisible, setPasteHintVisible] = useState(false);

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

  const fileTooLarge = useMemo(() => {
    if (!file) {
      return false;
    }

    return file.size > MAX_VERCEL_UPLOAD_BYTES;
  }, [file]);

  const selectedHistoryItem = useMemo(
    () => history.find((item) => item.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId],
  );

  const activeText = selectedHistoryItem?.text ?? result?.text ?? "";
  const activeIsRtl =
    selectedHistoryItem?.isRtl ?? result?.historyItem?.isRtl ?? false;
  const activeRecordingUrl =
    selectedHistoryItem?.recordingUrl ?? result?.historyItem?.recordingUrl ?? null;
  const activeFileName =
    selectedHistoryItem?.fileName ?? result?.fileName ?? "Transcript";
  const activeMimeType =
    selectedHistoryItem?.mimeType ?? result?.mimeType ?? "";

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
        // Keep the current item if refresh fails.
      }
    }

    void refreshSelectedRecording();

    return () => {
      cancelled = true;
    };
  }, [selectedHistoryId]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const clipboardFile = extractClipboardFile(event.clipboardData);

      if (!clipboardFile) {
        return;
      }

      setFile(clipboardFile);
      setError(null);
      setResult(null);
      setSelectedHistoryId(null);
      setPasteHintVisible(false);
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, []);

  useEffect(() => {
    if (!copyState) {
      return;
    }

    const timeout = window.setTimeout(() => setCopyState(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  function handlePickedFile(nextFile: File | null) {
    setFile(nextFile);
    setError(null);
    setResult(null);
    setSelectedHistoryId(null);
    setPasteHintVisible(false);
  }

  async function handlePasteClick() {
    const clipboard = navigator.clipboard as ClipboardWithRead;

    if (clipboard.read) {
      try {
        const items = await clipboard.read();

        for (const item of items) {
          const type =
            item.types.find((entry) => entry.startsWith("audio/")) ??
            item.types.find((entry) => entry.startsWith("video/"));

          if (!type) {
            continue;
          }

          const blob = await item.getType(type);
          const extension = type.split("/")[1] ?? "file";
          const pastedFile = new File([blob], `pasted.${extension}`, { type });

          handlePickedFile(pastedFile);
          return;
        }
      } catch {
        // Fall back to a focused paste target below.
      }
    }

    setPasteHintVisible(true);
    setError(null);
    pasteInputRef.current?.focus();
    pasteInputRef.current?.select();
  }

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(key);
    } catch {
      setError(t.copyFailed);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requiresGoogleSignIn && !userEmail) {
      setError(t.signInToTranscribe);
      return;
    }

    if (!file) {
      setError(t.chooseOrPaste);
      return;
    }

    if (fileTooLarge) {
      setError(t.fileTooLarge);
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
          "error" in payload ? payload.error : t.transcribeFailed,
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
        responseError instanceof Error ? responseError.message : t.transcribeFailed,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRecording(id: string) {
    const confirmed = window.confirm(t.deletePrompt);

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
        throw new Error("error" in payload ? payload.error : t.deleteFailed);
      }

      setHistory((current) => {
        const nextHistory = current.filter((item) => item.id !== payload.id);

        if (selectedHistoryId === payload.id) {
          setSelectedHistoryId(nextHistory[0]?.id ?? null);
        }

        return nextHistory;
      });
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : t.deleteFailed);
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6 lg:gap-8">
      <header className="flex flex-col gap-5 rounded-[1.75rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(239,245,255,0.82))] p-5 shadow-[0_18px_60px_rgba(76,101,151,0.08)] sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Link className="text-sm font-medium tracking-[0.22em] text-slate-500" href="/">
            Whisper
          </Link>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.07em] text-slate-950 sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
            {t.intro}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
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
                href="/auth/login"
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
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  {t.chooseFile}
                </button>
                <button
                  aria-label={t.pasteFile}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={handlePasteClick}
                  title={t.pasteFile}
                  type="button"
                >
                  <PasteIcon />
                </button>
              </div>
            </div>

            <input
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={(event) => handlePickedFile(event.target.files?.[0] ?? null)}
              ref={fileInputRef}
              type="file"
            />
            <textarea
              className="sr-only"
              onChange={() => {}}
              onPaste={(event) => {
                const clipboardFile = extractClipboardFile(event.clipboardData);

                if (!clipboardFile) {
                  setError(t.fileNotFoundInPaste);
                  return;
                }

                handlePickedFile(clipboardFile);
              }}
              ref={pasteInputRef}
              tabIndex={-1}
              value=""
            />

            <button
              className="group flex min-h-56 flex-1 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300 bg-[linear-gradient(180deg,#f8fbff_0%,#f2f6ff_100%)] px-6 text-center transition hover:border-slate-400 hover:bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8ff_100%)]"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <div className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                {t.uploadBadge}
              </div>
              <p className="mt-5 text-lg font-medium tracking-[-0.04em] text-slate-900">
                {t.uploadTitle}
              </p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                {t.uploadBody}
              </p>
            </button>

            {pasteHintVisible ? (
              <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                {t.pasteHint}
              </div>
            ) : null}

            {file ? (
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-950">{file.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatBytes(file.size)}</p>
                  </div>
                  {fileTooLarge ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                      {t.tooLargeBadge}
                    </span>
                  ) : null}
                </div>
                {previewUrl ? (
                  <div className="mt-4">
                    {getFileKind(file) === "video" ? (
                      <video
                        className="max-h-64 w-full rounded-[1.25rem] bg-slate-950"
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
            ) : null}

            {!hasOpenAIKey ? (
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

            <button
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={
                !hasOpenAIKey ||
                !file ||
                fileTooLarge ||
                submitting ||
                (requiresGoogleSignIn && !userEmail)
              }
              type="submit"
            >
              {submitting ? t.working : t.transcribe}
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
                {activeText ? activeFileName : t.transcriptPlaceholder}
              </p>
            </div>
            {activeText ? (
              <button
                aria-label={t.copyTranscript}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => copyText("active", activeText)}
                title={copyState === "active" ? t.copied : t.copyTranscript}
                type="button"
              >
                <CopyIcon />
              </button>
            ) : null}
          </div>

          {activeRecordingUrl ? (
            <div className="mt-5">
              {activeMimeType.startsWith("video/") ? (
                <video
                  className="max-h-72 w-full rounded-[1.25rem] bg-slate-950"
                  controls
                  preload="metadata"
                  src={activeRecordingUrl}
                />
              ) : (
                <audio className="w-full" controls preload="metadata" src={activeRecordingUrl} />
              )}
            </div>
          ) : null}

          {activeText ? (
            <div className="mt-5 flex-1 rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#fcfdff_0%,#f5f8ff_100%)] p-1">
              <textarea
                className={`min-h-[22rem] w-full resize-none rounded-[1.25rem] bg-transparent px-4 py-4 text-sm leading-8 text-slate-800 outline-none sm:text-[15px] ${
                  activeIsRtl ? "text-right" : "text-left"
                }`}
                dir={activeIsRtl ? "rtl" : "ltr"}
                readOnly
                value={activeText}
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
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {history.map((item) => (
              <article
                key={item.id}
                className={`rounded-[1.5rem] border p-4 transition ${
                  item.id === selectedHistoryId
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_14px_40px_rgba(15,23,42,0.16)]"
                    : "border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] text-slate-900 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setSelectedHistoryId(item.id);
                      setResult(null);
                    }}
                    type="button"
                  >
                    <p className="truncate text-sm font-medium">{item.fileName}</p>
                    <p
                      className={`mt-1 text-xs ${
                        item.id === selectedHistoryId ? "text-white/60" : "text-slate-500"
                      }`}
                    >
                      {formatDate(item.createdAt, locale)} · {formatBytes(item.size)}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label={`${t.copyTranscript} ${item.fileName}`}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                        item.id === selectedHistoryId
                          ? "border-white/15 bg-white/10 text-white hover:bg-white/16"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => copyText(item.id, item.text)}
                      title={copyState === item.id ? t.copied : t.copyTranscript}
                      type="button"
                    >
                      <CopyIcon />
                    </button>
                    <button
                      aria-label={`${t.delete} ${item.fileName}`}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                        item.id === selectedHistoryId
                          ? "border-white/15 bg-white/10 text-white hover:bg-white/16"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => deleteRecording(item.id)}
                      title={t.delete}
                      type="button"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                <button
                  className={`mt-4 block w-full text-left text-sm leading-7 ${
                    item.id === selectedHistoryId ? "text-white/88" : "text-slate-600"
                  }`}
                  dir={item.isRtl ? "rtl" : "ltr"}
                  onClick={() => {
                    setSelectedHistoryId(item.id);
                    setResult(null);
                  }}
                  type="button"
                >
                  <span className="line-clamp-4 whitespace-pre-wrap">{item.text}</span>
                </button>
              </article>
            ))}
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
