import {
  getTranscriptionRecordById,
  updateTranscriptionJob,
} from "@/db/queries";
import { hasDatabaseUrl } from "@/lib/env";
import { createSignedRecordingUrl } from "@/lib/supabase/admin";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { constants as fsConstants } from "node:fs";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

const execFileAsync = promisify(execFile);

export const MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";

export const MAX_VERCEL_UPLOAD_BYTES = 4.5 * 1024 * 1024;
export const MAX_TRANSCRIBE_CHUNK_BYTES = 24 * 1024 * 1024;
const AUDIO_BITRATE = "64k";
const AUDIO_SAMPLE_RATE = "16000";
const AUDIO_CHANNELS = "1";
const SEGMENT_SECONDS = Math.max(
  60,
  Math.floor((MAX_TRANSCRIBE_CHUNK_BYTES * 8) / 64000),
);

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

async function downloadRecordingToFile(
  bucket: string,
  path: string,
  outputPath: string,
) {
  const signedUrl = await createSignedRecordingUrl(bucket, path);

  if (!signedUrl) {
    throw new Error("Could not access the uploaded recording.");
  }

  const response = await fetch(signedUrl);

  if (!response.ok || !response.body) {
    throw new Error("Failed to download the uploaded recording.");
  }

  await pipeline(
    Readable.fromWeb(
      response.body as import("node:stream/web").ReadableStream,
    ),
    createWriteStream(outputPath),
  );
}

async function extractAudioChunks(inputPath: string, fileName: string) {
  const ffmpegPath = await resolveFfmpegPath();
  const outputDir = dirname(inputPath);
  const outputPattern = join(
    outputDir,
    `transcribe-chunk-${crypto.randomUUID()}-${getBaseName(fileName) || "audio"}-%03d.mp3`,
  );

  await execFileAsync(ffmpegPath, [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-map",
    "0:a:0",
    "-ac",
    AUDIO_CHANNELS,
    "-ar",
    AUDIO_SAMPLE_RATE,
    "-b:a",
    AUDIO_BITRATE,
    "-f",
    "segment",
    "-segment_time",
    String(SEGMENT_SECONDS),
    "-reset_timestamps",
    "1",
    outputPattern,
  ]);

  const outputPrefix = basename(outputPattern).split("%03d")[0];
  const files = (await readdir(outputDir))
    .filter((entry) => entry.startsWith(outputPrefix) && entry.endsWith(".mp3"))
    .sort()
    .map((entry) => join(outputDir, entry));

  if (files.length === 0) {
    throw new Error("Audio extraction failed.");
  }

  return files;
}

async function createTranscriptionChunkFile(chunkPath: string, index: number) {
  const chunkBuffer = await readFile(chunkPath);

  if (chunkBuffer.byteLength > MAX_TRANSCRIBE_CHUNK_BYTES) {
    throw new Error("A generated audio chunk still exceeds the transcription upload limit.");
  }

  return toFile(chunkBuffer, `chunk-${index + 1}.mp3`, {
    type: "audio/mpeg",
  });
}

export async function processTranscriptionJob(id: string, userId: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required for async transcription jobs.");
  }

  const job = await getTranscriptionRecordById(id, userId);

  if (!job) {
    throw new Error("Transcription job not found.");
  }

  if (!job.storageBucket || !job.storagePath) {
    throw new Error("Transcription job is missing a stored recording.");
  }

  const tempDir = await mkdtemp(join(tmpdir(), "transcription-job-"));

  try {
    await updateTranscriptionJob(id, {
      errorMessage: null,
      progress: 10,
      status: "extracting",
    });

    const inputPath = join(
      tempDir,
      `source${extname(job.fileName) || ""}`,
    );

    await downloadRecordingToFile(job.storageBucket, job.storagePath, inputPath);

    const chunkPaths = await extractAudioChunks(inputPath, job.fileName);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const chunks: string[] = [];

    for (const [index, chunkPath] of chunkPaths.entries()) {
      const progress = Math.min(
        95,
        25 + Math.round((index / Math.max(chunkPaths.length, 1)) * 65),
      );

      await updateTranscriptionJob(id, {
        progress,
        status: "transcribing",
      });

      const file = await createTranscriptionChunkFile(chunkPath, index);
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: MODEL,
      });

      chunks.push(transcription.text.trim());
    }

    await updateTranscriptionJob(id, {
      errorMessage: null,
      progress: 100,
      status: "completed",
      text: chunks.filter(Boolean).join("\n\n"),
    });
  } catch (error) {
    await updateTranscriptionJob(id, {
      errorMessage:
        error instanceof Error ? error.message : "Transcription failed.",
      progress: 100,
      status: "failed",
    });

    throw error;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}
