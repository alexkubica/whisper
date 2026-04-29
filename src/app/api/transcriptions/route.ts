import { listRecentTranscriptionsByUser } from "@/db/queries";
import { serializeHistoryItem } from "@/lib/history";
import { createSignedRecordingUrl } from "@/lib/supabase/admin";
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

export async function GET() {
  const userId = await getSignedInUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const history = await listRecentTranscriptionsByUser(userId);
  const items = await Promise.all(
    history.map(async (item) =>
      serializeHistoryItem(
        item,
        await createSignedRecordingUrl(item.storageBucket, item.storagePath),
      ),
    ),
  );

  return NextResponse.json({ items });
}
