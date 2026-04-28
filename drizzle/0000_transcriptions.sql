create extension if not exists pgcrypto;

create table if not exists "transcriptions" (
  "id" uuid primary key default gen_random_uuid() not null,
  "user_id" uuid not null references auth.users(id) on delete cascade,
  "file_name" text not null,
  "mime_type" text not null,
  "size" integer not null,
  "model" text not null,
  "text" text not null,
  "created_at" timestamp with time zone default now() not null
);

create index if not exists "transcriptions_user_id_idx"
  on "transcriptions" using btree ("user_id");

create index if not exists "transcriptions_user_id_created_at_idx"
  on "transcriptions" using btree ("user_id", "created_at" desc);
