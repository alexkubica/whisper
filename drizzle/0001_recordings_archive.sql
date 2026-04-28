alter table "transcriptions"
  add column if not exists "storage_bucket" text,
  add column if not exists "storage_path" text,
  add column if not exists "archived_at" timestamp with time zone;
