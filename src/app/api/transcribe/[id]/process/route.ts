import {
  getTranscriptionRecordById,
  updateTranscriptionJob,
} from "@/db/queries";
import { serializeHistoryItem } from "@/lib/history";
import { processTranscriptionJob } from "@/lib/transcription";
import { createSignedRecordingUrl } from "@/lib/supabase/admin";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { after, NextResponse } from "next/server";
import { isAuthorizedUser } from "@/lib/auth-authorization";

export const runtime = "nodejs";
export const maxDuration = 300;

async function getSignedInUserId() {
  const supabase = await createRouteHandlerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return isAuthorizedUser(user) ? user.id : null;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getSignedInUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const job = await getTranscriptionRecordById(id, userId);

  if (!job) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  if (job.status !== "uploading" && job.status !== "failed") {
    const recordingUrl = await createSignedRecordingUrl(
      job.storageBucket,
      job.storagePath,
    );

    return NextResponse.json({
      item: serializeHistoryItem(job, recordingUrl),
    });
  }

  const queued = await updateTranscriptionJob(id, {
    errorMessage: null,
    progress: 5,
    status: "queued",
  });

  if (!queued) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  after(async () => {
    try {
      await processTranscriptionJob(id, userId);
    } catch (error) {
      console.error(error);
    }
  });

  const recordingUrl = await createSignedRecordingUrl(
    queued.storageBucket,
    queued.storagePath,
  );

  return NextResponse.json({
    item: serializeHistoryItem(queued, recordingUrl),
  });
}
