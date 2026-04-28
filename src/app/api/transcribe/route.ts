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
          "Files over 4.5 MB will be rejected by Vercel Functions in this simple setup.",
      },
      { status: 413 },
    );
  }

  try {
    let userId: string | null = null;
    const supabase = await createRouteHandlerClient();

    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      userId = user?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Sign in with Google before transcribing." },
        { status: 401 },
      );
    }

    const payload = await transcribeAndPersistFile(input, userId);

    return NextResponse.json(payload);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "OpenAI transcription failed.",
      },
      { status: 500 },
    );
  }
}
