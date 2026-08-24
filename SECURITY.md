# Security Policy

Report suspected vulnerabilities privately to the repository owner. Do not put
API keys, OAuth sessions, database URLs, recordings, transcripts, signed upload
URLs, or personal contact details in a public issue.

OpenAI and Supabase secret keys are server-only. Production transcription access
requires a valid Supabase Google session whose email is explicitly listed in
`AUTHORIZED_EMAILS`; the application fails closed when the allowlist is empty.
