import Link from "next/link";
import { cookies } from "next/headers";
import { AppSignInGate } from "@/components/app-signin-gate";
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

function localeHref(locale: Locale, redirectTo: string) {
  return `/api/locale?locale=${locale}&redirectTo=${encodeURIComponent(redirectTo)}`;
}

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

  if (!userId) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f5f8ff_0%,#eff4ff_40%,#f8fafc_100%)] px-4 py-4 text-slate-950 sm:px-6 sm:py-6">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col rounded-[2rem] border border-white/70 bg-white/72 p-4 shadow-[0_28px_100px_rgba(61,88,145,0.16)] backdrop-blur sm:p-6 lg:p-8">
          <header className="grid items-start gap-4 rounded-[1.75rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(239,245,255,0.82))] p-5 shadow-[0_18px_60px_rgba(76,101,151,0.08)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0 self-start">
              <Link className="text-sm font-medium tracking-[0.22em] text-slate-500" href="/">
                Miluli
              </Link>
            </div>
            <div className="flex shrink-0 justify-start lg:justify-end">
              <div className="flex items-center rounded-full border border-slate-200 bg-white/70 p-1">
                <a
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    locale === "en" ? "bg-slate-950 text-white" : "text-slate-600"
                  }`}
                  href={localeHref("en", "/app")}
                >
                  EN
                </a>
                <a
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    locale === "he" ? "bg-slate-950 text-white" : "text-slate-600"
                  }`}
                  href={localeHref("he", "/app")}
                >
                  HE
                </a>
              </div>
            </div>
          </header>

          <div className="flex flex-1 items-center justify-center py-6 sm:py-10">
            <AppSignInGate locale={locale} />
          </div>
        </div>
      </main>
    );
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
