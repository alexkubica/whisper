import { hasSupabaseAuth } from "@/lib/env";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import {
  ACCEPTED_EXTENSIONS,
  MAX_VERCEL_UPLOAD_BYTES,
  getExtension,
  transcribeAndPersistFile,
} from "@/lib/transcription";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function redirectWithStatus(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/?share=${status}`, request.url));
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/", request.url));
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
    const payload = await transcribeAndPersistFile(input, user.id);

    return NextResponse.redirect(
      new URL(
        payload.historyItem?.id
          ? `/?selected=${payload.historyItem.id}&share=ok`
          : "/?share=ok",
        request.url,
      ),
    );
  } catch (error) {
    console.error(error);
    return redirectWithStatus(request, "transcription-error");
  }
}
