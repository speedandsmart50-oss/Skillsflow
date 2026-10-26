-- Additive foundation for the Closing & Négociation learning area.
-- Existing community, account, commerce and skill tables are not altered.

create table if not exists public.learning_tracks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  position integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_competencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  rubric jsonb not null default '{}'::jsonb check (jsonb_typeof(rubric) = 'object'),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.learning_tracks(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  level smallint not null check (level between 1 and 4),
  title text not null check (char_length(title) between 1 and 160),
  objective text not null check (char_length(objective) between 1 and 500),
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (track_id, slug),
  unique (id, track_id)
);

create table if not exists public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  objective text not null check (char_length(objective) between 1 and 500),
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, slug),
  unique (id, module_id)
);

create table if not exists public.learning_exercises (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  lesson_id uuid,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  exercise_type text not null check (exercise_type in ('practice', 'quiz', 'simulation', 'objection', 'conversation_analysis')),
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (lesson_id, module_id) references public.learning_lessons(id, module_id) on delete cascade,
  unique (module_id, slug),
  unique (id, module_id)
);

create table if not exists public.learning_content_versions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.learning_modules(id) on delete cascade,
  lesson_id uuid references public.learning_lessons(id) on delete cascade,
  exercise_id uuid references public.learning_exercises(id) on delete cascade,
  version integer not null check (version > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  authored_by uuid references public.profiles(id) on delete set null,
  validated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (num_nonnulls(module_id, lesson_id, exercise_id) = 1),
  check (status <> 'published' or published_at is not null)
);

create unique index if not exists learning_content_module_version_key
  on public.learning_content_versions (module_id, version) where module_id is not null;
create unique index if not exists learning_content_lesson_version_key
  on public.learning_content_versions (lesson_id, version) where lesson_id is not null;
create unique index if not exists learning_content_exercise_version_key
  on public.learning_content_versions (exercise_id, version) where exercise_id is not null;
create index if not exists learning_modules_track_order_idx
  on public.learning_modules (track_id, level, position) where status = 'published';
create index if not exists learning_lessons_module_order_idx
  on public.learning_lessons (module_id, position) where status = 'published';
create index if not exists learning_exercises_module_order_idx
  on public.learning_exercises (module_id, position) where status = 'published';

create table if not exists public.learning_exercise_competencies (
  exercise_id uuid not null references public.learning_exercises(id) on delete cascade,
  competency_id uuid not null references public.learning_competencies(id) on delete restrict,
  weight numeric(5, 2) not null default 1 check (weight > 0 and weight <= 100),
  primary key (exercise_id, competency_id)
);

create table if not exists public.learning_sources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.learning_lessons(id) on delete cascade,
  exercise_id uuid references public.learning_exercises(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  url text not null check (url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(lesson_id, exercise_id) = 1)
);

create table if not exists public.learning_module_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  current_lesson_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id),
  foreign key (current_lesson_id, module_id) references public.learning_lessons(id, module_id) on delete set null (current_lesson_id),
  check ((status = 'completed') = (completed_at is not null))
);
create index if not exists learning_module_progress_user_activity_idx
  on public.learning_module_progress (user_id, last_activity_at desc);

create table if not exists public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.learning_exercises(id) on delete cascade,
  submitted_content jsonb not null check (jsonb_typeof(submitted_content) in ('object', 'array')),
  feedback jsonb,
  competency_scores jsonb,
  evaluated_by text check (evaluated_by in ('rules', 'ai', 'coach')),
  status text not null default 'submitted' check (status in ('submitted', 'evaluated', 'failed')),
  created_at timestamptz not null default now(),
  evaluated_at timestamptz,
  check ((status = 'evaluated') = (evaluated_at is not null))
);
create index if not exists learning_attempts_user_recent_idx
  on public.learning_attempts (user_id, created_at desc);
create index if not exists learning_attempts_exercise_recent_idx
  on public.learning_attempts (exercise_id, created_at desc);

create table if not exists public.learning_competency_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  competency_id uuid not null references public.learning_competencies(id) on delete cascade,
  mastery_level smallint not null default 0 check (mastery_level between 0 and 4),
  evidence_attempt_id uuid references public.learning_attempts(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, competency_id)
);

create table if not exists public.learning_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  due_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id, due_at)
);
create index if not exists learning_reviews_due_idx
  on public.learning_reviews (user_id, due_at) where completed_at is null;

create table if not exists public.learning_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_context text,
  preferred_channel text check (preferred_channel is null or preferred_channel in ('messages', 'call', 'video', 'in_person')),
  communication_style text,
  updated_at timestamptz not null default now()
);

create or replace function public.learning_user_can_access_content()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and (
    public.community_is_staff()
    or exists (
      select 1
      from public.community_memberships cm
      join public.profiles p on p.id = cm.user_id
      join public.community_rules r on r.version = p.community_rules_version and r.is_active
      where cm.user_id = auth.uid()
    )
  );
$$;
revoke all on function public.learning_user_can_access_content() from public, anon;
grant execute on function public.learning_user_can_access_content() to authenticated;

alter table public.learning_tracks enable row level security;
alter table public.learning_competencies enable row level security;
alter table public.learning_modules enable row level security;
alter table public.learning_lessons enable row level security;
alter table public.learning_exercises enable row level security;
alter table public.learning_content_versions enable row level security;
alter table public.learning_exercise_competencies enable row level security;
alter table public.learning_sources enable row level security;
alter table public.learning_module_progress enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.learning_competency_progress enable row level security;
alter table public.learning_reviews enable row level security;
alter table public.learning_preferences enable row level security;

revoke all on public.learning_tracks, public.learning_competencies, public.learning_modules,
  public.learning_lessons, public.learning_exercises, public.learning_content_versions,
  public.learning_exercise_competencies, public.learning_sources, public.learning_module_progress,
  public.learning_attempts, public.learning_competency_progress, public.learning_reviews,
  public.learning_preferences from anon, authenticated;

grant select, insert, update, delete on public.learning_tracks, public.learning_competencies, public.learning_modules,
  public.learning_lessons, public.learning_exercises, public.learning_content_versions,
  public.learning_exercise_competencies, public.learning_sources to authenticated;
grant select, insert on public.learning_module_progress to authenticated;
grant update (status, current_lesson_id, started_at, completed_at, last_activity_at, updated_at) on public.learning_module_progress to authenticated;
grant select, insert (user_id, exercise_id, submitted_content) on public.learning_attempts to authenticated;
grant update (feedback, competency_scores, evaluated_by, status, evaluated_at) on public.learning_attempts to authenticated;
grant select, insert, update, delete on public.learning_competency_progress to authenticated;
grant select, insert, update, delete on public.learning_reviews to authenticated;
grant select, insert, update on public.learning_preferences to authenticated;
grant all on public.learning_tracks, public.learning_competencies, public.learning_modules,
  public.learning_lessons, public.learning_exercises, public.learning_content_versions,
  public.learning_exercise_competencies, public.learning_sources, public.learning_module_progress,
  public.learning_attempts, public.learning_competency_progress, public.learning_reviews,
  public.learning_preferences to service_role;

create policy learning_tracks_read_published on public.learning_tracks
  for select to authenticated using (status = 'published' and public.learning_user_can_access_content());
create policy learning_tracks_staff_manage on public.learning_tracks
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());
create policy learning_competencies_read_active on public.learning_competencies
  for select to authenticated using (is_active and public.learning_user_can_access_content());
create policy learning_competencies_staff_manage on public.learning_competencies
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());
create policy learning_modules_read_published on public.learning_modules
  for select to authenticated using (public.learning_user_can_access_content() and status = 'published' and exists (
    select 1 from public.learning_tracks t where t.id = track_id and t.status = 'published'
  ));
create policy learning_modules_staff_manage on public.learning_modules
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());
create policy learning_lessons_read_published on public.learning_lessons
  for select to authenticated using (public.learning_user_can_access_content() and status = 'published' and exists (
    select 1 from public.learning_modules m join public.learning_tracks t on t.id = m.track_id
    where m.id = module_id and m.status = 'published' and t.status = 'published'
  ));
create policy learning_lessons_staff_manage on public.learning_lessons
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());
create policy learning_exercises_read_published on public.learning_exercises
  for select to authenticated using (public.learning_user_can_access_content() and status = 'published' and exists (
    select 1 from public.learning_modules m join public.learning_tracks t on t.id = m.track_id
    where m.id = module_id and m.status = 'published' and t.status = 'published'
  ));
create policy learning_exercises_staff_manage on public.learning_exercises
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());
create policy learning_versions_read_published on public.learning_content_versions
  for select to authenticated using (public.learning_user_can_access_content() and status = 'published' and (
    (module_id is not null and exists (select 1 from public.learning_modules m join public.learning_tracks t on t.id = m.track_id where m.id = module_id and m.status = 'published' and t.status = 'published'))
    or (lesson_id is not null and exists (select 1 from public.learning_lessons l join public.learning_modules m on m.id = l.module_id join public.learning_tracks t on t.id = m.track_id where l.id = lesson_id and l.status = 'published' and m.status = 'published' and t.status = 'published'))
    or (exercise_id is not null and exists (select 1 from public.learning_exercises e join public.learning_modules m on m.id = e.module_id join public.learning_tracks t on t.id = m.track_id where e.id = exercise_id and e.status = 'published' and m.status = 'published' and t.status = 'published'))
  ));
create policy learning_versions_staff_manage on public.learning_content_versions
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());
create policy learning_exercise_competencies_read_published on public.learning_exercise_competencies
  for select to authenticated using (public.learning_user_can_access_content() and exists (
    select 1 from public.learning_exercises e join public.learning_modules m on m.id = e.module_id join public.learning_tracks t on t.id = m.track_id
    where e.id = exercise_id and e.status = 'published' and m.status = 'published' and t.status = 'published'
  ));
create policy learning_exercise_competencies_staff_manage on public.learning_exercise_competencies
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());
create policy learning_sources_read_published on public.learning_sources
  for select to authenticated using (public.learning_user_can_access_content() and (
    (lesson_id is not null and exists (select 1 from public.learning_lessons l join public.learning_modules m on m.id = l.module_id join public.learning_tracks t on t.id = m.track_id where l.id = lesson_id and l.status = 'published' and m.status = 'published' and t.status = 'published'))
    or (exercise_id is not null and exists (select 1 from public.learning_exercises e join public.learning_modules m on m.id = e.module_id join public.learning_tracks t on t.id = m.track_id where e.id = exercise_id and e.status = 'published' and m.status = 'published' and t.status = 'published'))
  ));
create policy learning_sources_staff_manage on public.learning_sources
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());

create policy learning_progress_read_self on public.learning_module_progress
  for select to authenticated using (user_id = auth.uid());
create policy learning_progress_write_self on public.learning_module_progress
  for insert to authenticated with check (user_id = auth.uid() and public.learning_user_can_access_content() and exists (
    select 1 from public.learning_modules m join public.learning_tracks t on t.id = m.track_id
    where m.id = module_id and m.status = 'published' and t.status = 'published'
  ));
create policy learning_progress_update_self on public.learning_module_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.learning_user_can_access_content() and exists (
    select 1 from public.learning_modules m join public.learning_tracks t on t.id = m.track_id
    where m.id = module_id and m.status = 'published' and t.status = 'published'
  ));
create policy learning_attempts_read_self on public.learning_attempts
  for select to authenticated using (user_id = auth.uid());
create policy learning_attempts_insert_self on public.learning_attempts
  for insert to authenticated with check (user_id = auth.uid() and public.learning_user_can_access_content() and status = 'submitted' and evaluated_at is null and feedback is null and competency_scores is null and evaluated_by is null and exists (
    select 1 from public.learning_exercises e join public.learning_modules m on m.id = e.module_id join public.learning_tracks t on t.id = m.track_id
    where e.id = exercise_id and e.status = 'published' and m.status = 'published' and t.status = 'published'
  ));
create policy learning_competency_progress_read_self on public.learning_competency_progress
  for select to authenticated using (user_id = auth.uid());
create policy learning_reviews_read_self on public.learning_reviews
  for select to authenticated using (user_id = auth.uid());
create policy learning_reviews_write_self on public.learning_reviews
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy learning_preferences_read_self on public.learning_preferences
  for select to authenticated using (user_id = auth.uid());
create policy learning_preferences_write_self on public.learning_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Staff may update evaluations and calculated competency scores; member policies above
-- intentionally keep submissions and learning history private to their owner.
create policy learning_attempts_staff_evaluate on public.learning_attempts
  for update to authenticated using (public.community_is_staff()) with check (public.community_is_staff());
create policy learning_competency_progress_staff_write on public.learning_competency_progress
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());

