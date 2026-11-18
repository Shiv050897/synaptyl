-- SYNAPTYL initial learning schema
-- Applied to the dedicated SYNAPTYL Supabase project.
create schema if not exists private;
create type public.learning_track as enum ('k12', 'gk_gs');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_admin() to authenticated;

create table public.school_classes (
  id uuid primary key default gen_random_uuid(),
  class_number smallint not null unique check (class_number between 1 and 12),
  stage text not null check (stage in ('primary', 'middle', 'secondary', 'senior_secondary')),
  display_name text not null,
  sort_order smallint not null
);

create table public.exam_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  track public.learning_track not null,
  school_class_id uuid references public.school_classes(id) on delete cascade,
  name text not null,
  slug text not null,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint subjects_track_class_check check (
    (track = 'k12' and school_class_id is not null)
    or (track = 'gk_gs' and school_class_id is null)
  ),
  constraint subjects_unique_per_class unique (track, school_class_id, slug)
);
create unique index subjects_single_gkgs_slug
  on public.subjects (slug) where track = 'gk_gs';

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  parent_id uuid,
  name text not null,
  slug text not null,
  description text,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint topics_id_subject_unique unique (id, subject_id),
  constraint topics_parent_same_subject_fk foreign key (parent_id, subject_id)
    references public.topics (id, subject_id) on delete cascade,
  constraint topics_unique_slug_per_subject unique (subject_id, slug)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  topic_id uuid not null,
  question_type text not null check (question_type in ('mcq', 'written', 'numerical')),
  prompt text not null,
  content jsonb not null default '{}'::jsonb,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  marks numeric(8,2) not null default 1 check (marks >= 0),
  negative_marks numeric(8,2) not null default 0 check (negative_marks >= 0),
  language_code text not null default 'en',
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_topic_subject_fk foreign key (topic_id, subject_id)
    references public.topics (id, subject_id) on delete restrict
);
create index questions_subject_status_idx on public.questions(subject_id, status);
create index questions_topic_status_idx on public.questions(topic_id, status);
create index questions_created_at_idx on public.questions(created_at desc);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null,
  content jsonb not null default '{}'::jsonb,
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  unique (question_id, sort_order),
  unique (id, question_id)
);

create table public.question_exam_categories (
  question_id uuid not null references public.questions(id) on delete cascade,
  exam_category_id uuid not null references public.exam_categories(id) on delete cascade,
  primary key (question_id, exam_category_id)
);

-- Correct answers and grading data are never placed in an exposed schema.
create table private.question_answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_option_id uuid references public.question_options(id) on delete set null,
  accepted_answers jsonb not null default '[]'::jsonb,
  grading_rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table private.question_solutions (
  question_id uuid primary key references public.questions(id) on delete cascade,
  explanation text,
  solution_content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  track public.learning_track not null,
  session_type text not null default 'practice' check (session_type in ('practice', 'mock_test')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index practice_sessions_user_started_idx on public.practice_sessions(user_id, started_at desc);

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  question_id uuid not null references public.questions(id) on delete restrict,
  submitted_answer jsonb not null,
  submitted_at timestamptz not null default now()
);
create index question_attempts_user_submitted_idx on public.question_attempts(user_id, submitted_at desc);
create index question_attempts_question_idx on public.question_attempts(question_id);

create table private.question_attempt_grades (
  attempt_id uuid primary key references public.question_attempts(id) on delete cascade,
  is_correct boolean,
  marks_awarded numeric(8,2),
  feedback jsonb not null default '{}'::jsonb,
  graded_at timestamptz not null default now()
);

create table public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger questions_touch_updated_at before update on public.questions
for each row execute function private.touch_updated_at();

revoke all on all tables in schema private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema private to service_role;
alter table private.user_roles enable row level security;
alter table private.question_answer_keys enable row level security;
alter table private.question_solutions enable row level security;
alter table private.question_attempt_grades enable row level security;

alter table public.profiles enable row level security;
alter table public.school_classes enable row level security;
alter table public.exam_categories enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_exam_categories enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.bookmarks enable row level security;

create policy profiles_select_own_or_admin on public.profiles
for select to authenticated using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_insert_own on public.profiles
for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own_or_admin on public.profiles
for update to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

create policy school_classes_read on public.school_classes
for select to authenticated using (true);
create policy school_classes_admin_manage on public.school_classes
for all to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy exam_categories_read on public.exam_categories
for select to authenticated using (true);
create policy exam_categories_admin_manage on public.exam_categories
for all to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy subjects_read on public.subjects
for select to authenticated using (true);
create policy subjects_admin_manage on public.subjects
for all to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy topics_read on public.topics
for select to authenticated using (true);
create policy topics_admin_manage on public.topics
for all to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy questions_read_published_or_admin on public.questions
for select to authenticated using (status = 'published' or (select private.is_admin()));
create policy questions_admin_manage on public.questions
for all to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy question_options_read_published_or_admin on public.question_options
for select to authenticated using (
  exists (select 1 from public.questions q where q.id = question_id
    and (q.status = 'published' or (select private.is_admin())))
);
create policy question_options_admin_manage on public.question_options
for all to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy question_exam_categories_read_published_or_admin on public.question_exam_categories
for select to authenticated using (
  exists (select 1 from public.questions q where q.id = question_id
    and (q.status = 'published' or (select private.is_admin())))
);
create policy question_exam_categories_admin_manage on public.question_exam_categories
for all to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy practice_sessions_select_own on public.practice_sessions
for select to authenticated using (user_id = (select auth.uid()));
create policy practice_sessions_insert_own on public.practice_sessions
for insert to authenticated with check (user_id = (select auth.uid()));
create policy practice_sessions_update_own on public.practice_sessions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy question_attempts_select_own on public.question_attempts
for select to authenticated using (user_id = (select auth.uid()));
create policy question_attempts_insert_own on public.question_attempts
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.practice_sessions ps
    where ps.id = session_id and ps.user_id = (select auth.uid()))
  and exists (select 1 from public.questions q
    where q.id = question_id and q.status = 'published')
);

create policy bookmarks_select_own on public.bookmarks
for select to authenticated using (user_id = (select auth.uid()));
create policy bookmarks_insert_own on public.bookmarks
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.questions q
    where q.id = question_id and q.status = 'published')
);
create policy bookmarks_delete_own on public.bookmarks
for delete to authenticated using (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select on public.school_classes, public.exam_categories, public.subjects, public.topics to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.questions, public.question_options,
  public.question_exam_categories, public.school_classes, public.exam_categories,
  public.subjects, public.topics to authenticated;
grant select, insert, update on public.practice_sessions to authenticated;
grant select, insert on public.question_attempts to authenticated;
grant select, insert, delete on public.bookmarks to authenticated;

revoke all on public.profiles, public.school_classes, public.exam_categories, public.subjects,
  public.topics, public.questions, public.question_options, public.question_exam_categories,
  public.practice_sessions, public.question_attempts, public.bookmarks from anon;

insert into public.school_classes (class_number, stage, display_name, sort_order)
select n,
  case when n between 1 and 5 then 'primary'
       when n between 6 and 8 then 'middle'
       when n between 9 and 10 then 'secondary'
       else 'senior_secondary' end,
  'Class ' || n, n
from generate_series(1, 12) as n;

insert into public.subjects (track, school_class_id, name, slug, display_order)
select 'k12'::public.learning_track, c.id, s.name, s.slug, s.display_order
from public.school_classes c
cross join (values
  ('Mathematics', 'mathematics', 1),
  ('Science', 'science', 2),
  ('English', 'english', 3),
  ('Social Science', 'social-science', 4),
  ('Computer Science', 'computer-science', 5)
) as s(name, slug, display_order);

insert into public.subjects (track, school_class_id, name, slug, display_order)
values ('gk_gs', null, 'General Knowledge & General Studies',
  'general-knowledge-general-studies', 1);

insert into public.topics (subject_id, name, slug, display_order)
select s.id, t.name, t.slug, t.display_order
from public.subjects s
cross join (values
  ('Static GK', 'static-gk', 1),
  ('General Science', 'general-science', 2),
  ('Indian History', 'indian-history', 3),
  ('Geography', 'geography', 4),
  ('Indian Polity', 'indian-polity', 5),
  ('Indian Economy', 'indian-economy', 6),
  ('Current Affairs', 'current-affairs', 7),
  ('Environment', 'environment', 8)
) as t(name, slug, display_order)
where s.track = 'gk_gs';

insert into public.exam_categories (name, slug, sort_order)
values
  ('SSC', 'ssc', 1),
  ('Railway', 'railway', 2),
  ('Teaching', 'teaching', 3),
  ('Banking', 'banking', 4),
  ('Defence', 'defence', 5),
  ('Other competitive exams', 'other-competitive-exams', 6);
