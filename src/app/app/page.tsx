import { cookies } from "next/headers";
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
import { LOCALE_COOKIE, type Locale, isLocale } from "@/lib/locale";
import { createSignedRecordingUrl } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const localeValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(localeValue) ? localeValue : "en";
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5f8ff_0%,#eff4ff_40%,#f8fafc_100%)] px-4 py-4 text-slate-950 sm:px-6 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col rounded-[2rem] border border-white/70 bg-white/72 p-4 shadow-[0_28px_100px_rgba(61,88,145,0.16)] backdrop-blur sm:p-6 lg:p-8">
        <Transcriber
          authEnabled={hasSupabaseAuth()}
          historyEnabled={hasDatabaseUrl()}
          hasOpenAIKey={hasOpenAIKey()}
          initialHistory={initialHistory}
          initialSelectedHistoryId={initialSelectedHistoryId}
          locale={locale}
          shareStatus={shareStatus}
          recordingStorageEnabled={hasSupabaseStorageAdmin()}
          userEmail={userEmail}
        />
      </div>
    </main>
  );
}
