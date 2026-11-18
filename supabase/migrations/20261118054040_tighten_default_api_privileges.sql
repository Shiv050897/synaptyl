-- Supabase defaults may grant CRUD privileges to anon/authenticated.
-- Reset application privileges, then regrant only the intended operations.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

revoke usage on schema public from public;
grant usage on schema public to authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

grant select on public.school_classes, public.exam_categories, public.subjects, public.topics to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on
  public.questions, public.question_options, public.question_exam_categories,
  public.school_classes, public.exam_categories, public.subjects, public.topics
  to authenticated;
grant select, insert, update on public.practice_sessions to authenticated;
grant select, insert on public.question_attempts to authenticated;
grant select, insert, delete on public.bookmarks to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
