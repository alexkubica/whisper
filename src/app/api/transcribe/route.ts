import { createTranscriptionJob } from "@/db/queries";
import { hasDatabaseUrl, hasSupabaseAuth } from "@/lib/env";
import { serializeHistoryItem } from "@/lib/history";
import {
  ACCEPTED_EXTENSIONS,
  MODEL,
  MAX_VERCEL_UPLOAD_BYTES,
  getExtension,
} from "@/lib/transcription";
import { createSignedRecordingUpload } from "@/lib/supabase/admin";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type CreateJobPayload = {
  fileName?: string;
  mimeType?: string;
  size?: number;
};

async function getSignedInUserId() {
  const supabase = await createRouteHandlerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  if (!hasSupabaseAuth()) {
    return NextResponse.json(
      { error: "Supabase Google auth must be configured." },
      { status: 500 },
    );
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "DATABASE_URL is required for async transcriptions." },
      { status: 500 },
    );
  }

  const userId = await getSignedInUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in with Google before transcribing." },
      { status: 401 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as CreateJobPayload;
    const fileName = body.fileName?.trim() ?? "";
    const mimeType = body.mimeType?.trim() || "application/octet-stream";
    const size = typeof body.size === "number" ? body.size : Number.NaN;

    if (!fileName || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Missing file metadata." }, { status: 400 });
    }

    if (!ACCEPTED_EXTENSIONS.has(getExtension(fileName))) {
      return NextResponse.json(
        { error: "Unsupported file type." },
        { status: 400 },
      );
    }

    const upload = await createSignedRecordingUpload({ fileName, userId });

    if (!upload) {
      return NextResponse.json(
        { error: "Supabase Storage admin is not configured." },
        { status: 500 },
      );
    }

    const job = await createTranscriptionJob({
      userId,
      fileName,
      mimeType,
      model: MODEL,
      size,
      storageBucket: upload.bucket,
      storagePath: upload.path,
    });

    return NextResponse.json({
      item: serializeHistoryItem(job, null),
      upload: {
        path: upload.path,
        signedUrl: upload.signedUrl,
        token: upload.token,
      },
    });
  }

  const formData = await request.formData();
  const input = formData.get("file");

  if (!(input instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  if (!ACCEPTED_EXTENSIONS.has(getExtension(input.name))) {
    return NextResponse.json(
      { error: "Unsupported file type." },
      { status: 400 },
    );
  }

  if (input.size > MAX_VERCEL_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error:
          "Shared uploads over 4.5 MB still need to be opened in the app first.",
      },
      { status: 413 },
    );
  }

  return NextResponse.json(
    { error: "Direct uploads must be created from the app." },
    { status: 400 },
  );
}
