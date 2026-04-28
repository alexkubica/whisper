alter table "transcriptions" enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transcriptions'
      and policyname = 'transcriptions_select_own'
  ) then
    create policy "transcriptions_select_own"
      on "transcriptions"
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transcriptions'
      and policyname = 'transcriptions_insert_own'
  ) then
    create policy "transcriptions_insert_own"
      on "transcriptions"
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transcriptions'
      and policyname = 'transcriptions_update_own'
  ) then
    create policy "transcriptions_update_own"
      on "transcriptions"
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transcriptions'
      and policyname = 'transcriptions_delete_own'
  ) then
    create policy "transcriptions_delete_own"
      on "transcriptions"
      for delete
      using (auth.uid() = user_id);
  end if;
end
$$;
