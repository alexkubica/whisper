create table if not exists "waitlist_signups" (
  "id" uuid primary key default gen_random_uuid(),
  "contact" text not null,
  "kind" text not null,
  "created_at" timestamp with time zone default now() not null
);

create unique index if not exists "waitlist_signups_contact_idx"
  on "waitlist_signups" ("contact");
