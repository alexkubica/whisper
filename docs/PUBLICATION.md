# Publication Checklist

- Keep `.env*`, `.vercel/`, recordings, transcripts, exports, cost reports, and
  local Python virtual environments out of Git.
- Configure a private Supabase Storage bucket, table RLS, Google OAuth, and an
  exact `AUTHORIZED_EMAILS` list before enabling transcription.
- Keep OpenAI, Supabase secret, and Postgres credentials server-side; only the
  Supabase URL and publishable key may use `NEXT_PUBLIC_`.
- Leave `WAITLIST_ENABLED=false` unless the endpoint has durable distributed
  abuse controls appropriate for the deployment.
- Use provider spend limits and rotate any key ever pasted into source, logs,
  issues, or chat.
- Run lint, type checking, build, dependency audit, current-tree secret scan,
  and full-history secret scan.
- Review recordings and transcripts for consent, retention, deletion, and
  sharing rights.
- Choose an open-source license only if reuse rights should be granted.
