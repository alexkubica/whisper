import { Transcriber } from "@/components/transcriber";
import { listRecentTranscriptionsByUser } from "@/db/queries";
import {
  hasDatabaseUrl,
  hasOpenAIKey,
  hasSupabaseAuth,
  hasSupabaseStorageAdmin,
} from "@/lib/env";
import type { HistoryItem } from "@/lib/history";
import { serializeHistoryItem } from "@/lib/history";
import { createSignedRecordingUrl } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedParam = resolvedSearchParams.selected;
  const shareParam = resolvedSearchParams.share;
  const selectedId =
    typeof selectedParam === "string" ? selectedParam : null;
  const shareStatus = typeof shareParam === "string" ? shareParam : null;
  let userEmail: string | null = null;
  let userId: string | null = null;
  let initialHistory: HistoryItem[] = [];

  if (hasSupabaseAuth()) {
    const supabase = await createSupabaseServerClient();

    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      userEmail = user?.email ?? null;
      userId = user?.id ?? null;
    }
  }

  if (userId && hasDatabaseUrl()) {
    const history = await listRecentTranscriptionsByUser(userId);
    initialHistory = await Promise.all(
      history.map(async (item) =>
        serializeHistoryItem(
          item,
          await createSignedRecordingUrl(item.storageBucket, item.storagePath),
        ),
      ),
    );
  }

  const initialSelectedHistoryId =
    (selectedId &&
      initialHistory.some((item) => item.id === selectedId) &&
      selectedId) ||
    initialHistory[0]?.id ||
    null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f8f3e8,transparent_38%),linear-gradient(180deg,#f4efe4_0%,#ece6d8_100%)] px-4 py-6 text-stone-900 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col rounded-[2rem] border border-stone-900/10 bg-white/80 p-5 shadow-[0_24px_80px_rgba(63,47,29,0.08)] backdrop-blur sm:p-8">
        <Transcriber
          authEnabled={hasSupabaseAuth()}
          historyEnabled={hasDatabaseUrl()}
          hasOpenAIKey={hasOpenAIKey()}
          initialHistory={initialHistory}
          initialSelectedHistoryId={initialSelectedHistoryId}
          shareStatus={shareStatus}
          recordingStorageEnabled={hasSupabaseStorageAdmin()}
          userEmail={userEmail}
        />
      </div>
    </main>
  );
}
