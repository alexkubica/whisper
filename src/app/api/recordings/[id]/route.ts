import {
  deleteTranscriptionRecord,
  getTranscriptionRecordById,
  setTranscriptionArchivedState,
} from "@/db/queries";
import { serializeHistoryItem } from "@/lib/history";
import { deleteRecordingObject, createSignedRecordingUrl } from "@/lib/supabase/admin";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { NextResponse } from "next/server";

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getSignedInUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const record = await getTranscriptionRecordById(id, userId);

  if (!record) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  const recordingUrl = await createSignedRecordingUrl(
    record.storageBucket,
    record.storagePath,
  );

  return NextResponse.json({
    item: serializeHistoryItem(record, recordingUrl),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getSignedInUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { archived?: boolean };
  const updated = await setTranscriptionArchivedState(id, userId, Boolean(body.archived));

  if (!updated) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  const recordingUrl = await createSignedRecordingUrl(
    updated.storageBucket,
    updated.storagePath,
  );

  return NextResponse.json({
    item: serializeHistoryItem(updated, recordingUrl),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getSignedInUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await deleteTranscriptionRecord(id, userId);

  if (!deleted) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  await deleteRecordingObject(deleted.storageBucket, deleted.storagePath);

  return NextResponse.json({ id });
}
