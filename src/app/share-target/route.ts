import { createTranscriptionJob } from "@/db/queries";
import { uploadRecording } from "@/lib/supabase/admin";
import { hasSupabaseAuth } from "@/lib/env";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import {
  ACCEPTED_EXTENSIONS,
  MODEL,
  MAX_VERCEL_UPLOAD_BYTES,
  getExtension,
  processTranscriptionJob,
} from "@/lib/transcription";
import { after, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function redirectWithStatus(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/app?share=${status}`, request.url));
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/app", request.url));
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY || !hasSupabaseAuth()) {
    return redirectWithStatus(request, "config-error");
  }

  const supabase = await createRouteHandlerClient();

  if (!supabase) {
    return redirectWithStatus(request, "config-error");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return redirectWithStatus(request, "signin-required");
  }

  const formData = await request.formData();
  const input =
    formData.get("file") ??
    formData.get("files") ??
    formData.getAll("file")[0] ??
    formData.getAll("files")[0];

  if (!(input instanceof File)) {
    return redirectWithStatus(request, "missing-file");
  }

  if (!ACCEPTED_EXTENSIONS.has(getExtension(input.name))) {
    return redirectWithStatus(request, "unsupported-file");
  }

  if (input.size > MAX_VERCEL_UPLOAD_BYTES) {
    return redirectWithStatus(request, "file-too-large");
  }

  try {
    const storedRecording = await uploadRecording({
      buffer: Buffer.from(await input.arrayBuffer()),
      fileName: input.name,
      mimeType: input.type || "application/octet-stream",
      userId: user.id,
    });

    if (!storedRecording) {
      return redirectWithStatus(request, "config-error");
    }

    const job = await createTranscriptionJob({
      userId: user.id,
      fileName: input.name,
      mimeType: input.type || "application/octet-stream",
      model: MODEL,
      size: input.size,
      storageBucket: storedRecording.bucket,
      storagePath: storedRecording.path,
    });

    after(async () => {
      try {
        await processTranscriptionJob(job.id, user.id);
      } catch (error) {
        console.error(error);
      }
    });

    return NextResponse.redirect(
      new URL(
        `/app?selected=${job.id}&share=ok`,
        request.url,
      ),
    );
  } catch (error) {
    console.error(error);
    return redirectWithStatus(request, "transcription-error");
  }
}
