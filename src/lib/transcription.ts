import { createTranscriptionHistoryItem } from "@/db/queries";
import { hasDatabaseUrl } from "@/lib/env";
import { serializeHistoryItem } from "@/lib/history";
import { createSignedRecordingUrl, uploadRecording } from "@/lib/supabase/admin";
import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

const execFileAsync = promisify(execFile);

export const MAX_VERCEL_UPLOAD_BYTES = 4.5 * 1024 * 1024;
export const MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";

export const ACCEPTED_EXTENSIONS = new Set([
  "aac",
  "m4a",
  "mkv",
  "mov",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "ogg",
  "opus",
  "wav",
  "webm",
]);

const OPENAI_DIRECT_EXTENSIONS = new Set([
  "m4a",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "wav",
  "webm",
]);

export function getExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) ?? "" : "";
}

function getBaseName(fileName: string) {
  return basename(fileName, extname(fileName)).replace(/[^a-z0-9-_]/gi, "_");
}

async function resolveFfmpegPath() {
  const candidates = [
    ffmpegStatic,
    ffmpegStatic?.startsWith("/ROOT/")
      ? join(process.cwd(), ffmpegStatic.slice("/ROOT/".length))
      : null,
    join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "ffmpeg",
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (candidate === "ffmpeg") {
      return candidate;
    }

    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("ffmpeg is not available.");
}

async function transcodeToWav(input: File) {
  const ffmpegPath = await resolveFfmpegPath();

  const tempDir = await mkdtemp(join(tmpdir(), "transcribe-"));
  const inputPath = join(tempDir, `input${extname(input.name) || ""}`);
  const outputPath = join(tempDir, `${getBaseName(input.name) || "audio"}.wav`);

  try {
    const inputBuffer = Buffer.from(await input.arrayBuffer());
    await writeFile(inputPath, inputBuffer);

    await execFileAsync(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      outputPath,
    ]);

    const outputBuffer = await readFile(outputPath);

    return {
      buffer: outputBuffer,
      fileName: `${getBaseName(input.name) || "audio"}.wav`,
      mimeType: "audio/wav",
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function normalizeUploadForOpenAI(input: File) {
  if (OPENAI_DIRECT_EXTENSIONS.has(getExtension(input.name))) {
    return {
      buffer: Buffer.from(await input.arrayBuffer()),
      fileName: input.name,
      mimeType: input.type || undefined,
    };
  }

  return transcodeToWav(input);
}

export async function transcribeAndPersistFile(input: File, userId: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const originalBuffer = Buffer.from(await input.arrayBuffer());
  const storedRecording = await uploadRecording({
    userId,
    fileName: input.name,
    mimeType: input.type || "application/octet-stream",
    buffer: originalBuffer,
  });

  const normalized = await normalizeUploadForOpenAI(input);
  const file = await toFile(normalized.buffer, normalized.fileName, {
    type: normalized.mimeType,
  });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: MODEL,
  });

  let historyItem = null;

  if (hasDatabaseUrl()) {
    const saved = await createTranscriptionHistoryItem({
      userId,
      fileName: input.name,
      mimeType: input.type || "application/octet-stream",
      size: input.size,
      model: MODEL,
      storageBucket: storedRecording?.bucket ?? null,
      storagePath: storedRecording?.path ?? null,
      text: transcription.text,
    });

    const recordingUrl = await createSignedRecordingUrl(
      saved.storageBucket,
      saved.storagePath,
    );

    historyItem = serializeHistoryItem(saved, recordingUrl);
  }

  return {
    fileName: input.name,
    historyItem,
    mimeType: input.type || normalized.mimeType,
    model: MODEL,
    size: input.size,
    text: transcription.text,
  };
}
