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
5. Set `AUTHORIZED_EMAILS` to the exact Google account(s) allowed to transcribe
6. Add `SUPABASE_SECRET_KEY` and optionally `SUPABASE_STORAGE_BUCKET` for server-side recording storage
7. Create a private Supabase Storage bucket named `recordings` or your configured bucket name
   The app will also try to create it automatically when `SUPABASE_SECRET_KEY` is configured.
8. Run `npm run db:migrate`
9. Run `npm run dev`

This repo uses a project-local `.npmrc` that points to the public npm registry.

## Local large-file transcription CLI

Use `transcribe_audio.py` when you want to transcribe local files over the
OpenAI 25 MB upload limit. The script uses `ffmpeg` to compress to mono MP3 at
16 kHz / 64 kbps, splits only when the compressed file is still too large, and
prints a cost estimate before making any OpenAI API call.

```bash
brew install ffmpeg
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY="..."
python transcribe_audio.py interview.m4a --estimate-only
python transcribe_audio.py interview.m4a
```

For non-interactive runs, pass `--yes` after reviewing the estimate:

```bash
python transcribe_audio.py interview.m4a --yes
python transcribe_audio.py interview.m4a --model gpt-4o-mini-transcribe --yes
python transcribe_audio.py interview.m4a --output interview.transcript.md
```

The built-in estimates use current OpenAI transcription pricing defaults:
`gpt-4o-transcribe` at `$0.006 / minute` and
`gpt-4o-mini-transcribe` at `$0.003 / minute`. Override with
`--price-per-minute` if pricing changes.

To see month-to-date OpenAI organization costs, add an admin key and run:

```bash
scripts/upload-openai-admin-key.sh --production
vercel --prod
```

For preview deployments too:

```bash
scripts/upload-openai-admin-key.sh --all
```

The upload script prompts with hidden input and passes the key to Vercel through
stdin, not as a CLI argument. OpenAI's public API exposes organization costs,
not remaining prepaid credit balance, so local `python transcribe_audio.py
--costs` reports spend when `OPENAI_ADMIN_KEY` is available.

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
- Google authentication is not sufficient by itself: every transcription and
  recording route also enforces `AUTHORIZED_EMAILS` and fails closed when it is
  missing.
- The waitlist endpoint is disabled unless `WAITLIST_ENABLED=true`.

Run `npm run lint`, `npm run typecheck`, and `npm run build` before publishing.
See `docs/PUBLICATION.md` for the privacy and release checklist.

No open-source license has been selected; normal copyright restrictions apply.
