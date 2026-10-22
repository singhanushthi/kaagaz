-- Kaagaz diary: run this once in Supabase → SQL Editor → New query → Run.
-- Each row is one diary page: the date, what the person wrote, and the poem.

create table if not exists public.entries (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date  date not null,
  thoughts    text not null default '' check (char_length(thoughts) <= 80000),
  title       text not null default '',
  poem        text not null check (char_length(poem) <= 20000),
  lang        text,
  shape       text,
  feel        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists entries_user_date on public.entries (user_id, entry_date desc, created_at desc);

-- Row Level Security: a signed-in person can only see and change their own pages.
alter table public.entries enable row level security;

drop policy if exists "read own entries"   on public.entries;
drop policy if exists "add own entries"    on public.entries;
drop policy if exists "edit own entries"   on public.entries;
drop policy if exists "delete own entries" on public.entries;

create policy "read own entries"   on public.entries for select to authenticated using (auth.uid() = user_id);
create policy "add own entries"    on public.entries for insert to authenticated with check (auth.uid() = user_id);
create policy "edit own entries"   on public.entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own entries" on public.entries for delete to authenticated using (auth.uid() = user_id);
