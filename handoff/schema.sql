-- Learning Hub schema (separate from written_test_*; same Supabase project = shared magic-link auth)
create table learning_hub_problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  subject text not null,            -- 'Maths' | 'Japanese' | ...
  topic text not null,              -- 'Aptitude', 'Calculus', 'Kanji' ...
  title text not null,
  prompt text not null,
  given text,
  kind text not null default 'Drill',      -- Drill | Worked example | Word problem | Proof
  tier int not null default 1,             -- 1 warm-up .. 4 exam-level
  created_at timestamptz default now()
);
create table learning_hub_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  seq int not null,                 -- Batch 07 -> 7
  problem_ids uuid[] not null,
  exported_at timestamptz default now(),
  status text not null default 'outbox'     -- outbox | solved | graded | archived
);
create table learning_hub_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  problem_id uuid references learning_hub_problems not null,
  batch_id uuid references learning_hub_batches,
  result text not null,             -- pass | fail
  source text not null default 'self',      -- self | ai_confirmed | ai_overridden
  ai_note text,
  note text,
  rating int,                       -- 1..5
  created_at timestamptz default now()
);
-- next-batch view: overdue first (no feedback in 7d), then weak (last=fail), then new
create view learning_hub_queue as
select p.*, f.last_result, f.last_at,
  case when f.last_at is null then 'new'
       when f.last_result = 'fail' then 'weak'
       when f.last_at < now() - interval '7 days' then 'due'
       else 'later' end as state
from learning_hub_problems p
left join lateral (
  select result as last_result, created_at as last_at
  from learning_hub_feedback where problem_id = p.id and user_id = auth.uid()
  order by created_at desc limit 1
) f on true;

alter table learning_hub_problems enable row level security;
alter table learning_hub_batches enable row level security;
alter table learning_hub_feedback enable row level security;
create policy "own rows" on learning_hub_problems for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on learning_hub_batches for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on learning_hub_feedback for all using (user_id = auth.uid()) with check (user_id = auth.uid());
