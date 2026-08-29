-- ============================================================================
-- WRITTEN TEST · LEARNING HUB v3 — schema delta
-- Run AFTER db/written_test_schema.sql (safe to re-run).
-- ============================================================================

-- 0 · Subjects — top-level grouping (Maths, Language study, Mechanical…)
create table if not exists written_test_subjects (
  id       text primary key,          -- slug, e.g. 'maths'
  sort_no  int  not null default 1,
  name     text not null,
  tagline  text
);
alter table written_test_topics add column if not exists subject_id text references written_test_subjects(id);

insert into written_test_subjects (id, sort_no, name, tagline) values
  ('maths', 1, 'Maths', 'Aptitude to ANOVA'),
  ('language_study', 2, 'Language study', 'Japanese · Kanji'),
  ('mechanical', 3, 'Mechanical', 'Engineering core')
on conflict (id) do nothing;
update written_test_topics set subject_id = 'maths' where subject_id is null;

-- Let the signed-in user manage the catalogue from inside the app
alter table written_test_subjects enable row level security;
drop policy if exists wt_subjects_rw on written_test_subjects;
create policy wt_subjects_rw on written_test_subjects for all to authenticated using (true) with check (true);
do $$ begin
  create policy wt_topics_write on written_test_topics for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy wt_problems_write on written_test_problems for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;

-- 1 · Organisation columns on problems
alter table written_test_problems add column if not exists tier text not null default 'core';
alter table written_test_problems add column if not exists kind text not null default 'drill';
alter table written_test_problems add column if not exists unit_no int;

do $$ begin
  alter table written_test_problems add constraint wt_tier_chk check (tier in ('warmup','core','challenge'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table written_test_problems add constraint wt_kind_chk check (kind in ('drill','concept','applied'));
exception when duplicate_object then null; end $$;

-- Seed tags for the existing 30 problems (adjust freely later):
-- №1 = warm-up, №2–4 = core, №5 = challenge · №1–2 drill, №3–4 concept, №5 applied
update written_test_problems set unit_no = number where unit_no is null;
update written_test_problems set tier = 'warmup'    where number = 1;
update written_test_problems set tier = 'core'      where number in (2,3,4);
update written_test_problems set tier = 'challenge' where number = 5;
update written_test_problems set kind = 'drill'     where number in (1,2);
update written_test_problems set kind = 'concept'   where number in (3,4);
update written_test_problems set kind = 'applied'   where number = 5;

-- 2 · Batches — one row per exported PDF
create table if not exists written_test_batches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic_id    text references written_test_topics(id) on delete set null,
  problem_ids text[] not null,
  filename    text not null,
  status      text not null default 'exported',   -- exported | solved | graded
  created_at  timestamptz not null default now(),
  graded_at   timestamptz
);
create index if not exists idx_wt_batches_user on written_test_batches(user_id);

alter table written_test_batches enable row level security;
drop policy if exists wt_batches_owner on written_test_batches;
create policy wt_batches_owner on written_test_batches for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3 · Cowork grading access
-- Claude Cowork writes attempts + batch status directly using the SERVICE ROLE key
-- (bypasses RLS). Keep that key ONLY on your Mac, e.g.:
--   mkdir -p ~/.config/writtentest && pbpaste > ~/.config/writtentest/service_role_key
-- Never commit it and never put it inside the iCloud-synced folder.
