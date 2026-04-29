alter table "transcriptions"
  add column if not exists "status" text not null default 'completed',
  add column if not exists "progress" integer not null default 100,
  add column if not exists "error_message" text;

alter table "transcriptions"
  alter column "text" set default '';
