# Transcribe

Minimal Next.js app for uploading an audio or video file and getting a transcript back.

## Stack

- Next.js App Router
- Tailwind CSS
- OpenAI Audio API for uploads
- Optional Supabase Google auth
- Drizzle ORM for typed Supabase Postgres access
- Supabase Storage for replayable uploaded recordings

## Local setup

1. Copy `.env.example` to `.env.local`
2. Add `OPENAI_API_KEY`
3. Add `DATABASE_URL` from Supabase if you want saved history
4. Add Supabase URL and publishable key for Google sign-in
5. Add `SUPABASE_SECRET_KEY` and optionally `SUPABASE_STORAGE_BUCKET` for server-side recording storage
6. Create a private Supabase Storage bucket named `recordings` or your configured bucket name
   The app will also try to create it automatically when `SUPABASE_SECRET_KEY` is configured.
7. Run `npm run db:migrate`
8. Run `npm run dev`

This repo uses a project-local `.npmrc` that points to the public npm registry.

## Notes

- The upload path uses `gpt-4o-mini-transcribe` by default.
- The current OpenAI list price for `gpt-4o-mini-transcribe` is about `$0.003 / minute`.
- Language is auto-detected by the transcription API because no language hint is sent.
- This simple Vercel deployment shape uses a direct function upload, so files above 4.5 MB are blocked to avoid Vercel request-size failures.
- Browser APIs are not used for file transcription in this version.
- Signed-in users get transcript history persisted to Supabase Postgres through Drizzle.
- Supabase browser/server auth uses the new publishable key format. A secret key can be configured for future server-only admin tasks, but it is not used for normal user history writes.
- Uploaded recordings are stored in Supabase Storage, can be played back from history, and can be archived or deleted.
- Hebrew and other RTL-heavy transcripts are rendered right-to-left automatically.
