-- Split admin mutations from learner read policies to avoid overlapping
-- permissive policies for SELECT.
drop policy if exists school_classes_admin_manage on public.school_classes;
create policy school_classes_admin_insert on public.school_classes
for insert to authenticated with check ((select private.is_admin()));
create policy school_classes_admin_update on public.school_classes
for update to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy school_classes_admin_delete on public.school_classes
for delete to authenticated using ((select private.is_admin()));

drop policy if exists exam_categories_admin_manage on public.exam_categories;
create policy exam_categories_admin_insert on public.exam_categories
for insert to authenticated with check ((select private.is_admin()));
create policy exam_categories_admin_update on public.exam_categories
for update to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy exam_categories_admin_delete on public.exam_categories
for delete to authenticated using ((select private.is_admin()));

drop policy if exists subjects_admin_manage on public.subjects;
create policy subjects_admin_insert on public.subjects
for insert to authenticated with check ((select private.is_admin()));
create policy subjects_admin_update on public.subjects
for update to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy subjects_admin_delete on public.subjects
for delete to authenticated using ((select private.is_admin()));

drop policy if exists topics_admin_manage on public.topics;
create policy topics_admin_insert on public.topics
for insert to authenticated with check ((select private.is_admin()));
create policy topics_admin_update on public.topics
for update to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy topics_admin_delete on public.topics
for delete to authenticated using ((select private.is_admin()));

drop policy if exists questions_admin_manage on public.questions;
create policy questions_admin_insert on public.questions
for insert to authenticated with check ((select private.is_admin()));
create policy questions_admin_update on public.questions
for update to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy questions_admin_delete on public.questions
for delete to authenticated using ((select private.is_admin()));

drop policy if exists question_options_admin_manage on public.question_options;
create policy question_options_admin_insert on public.question_options
for insert to authenticated with check ((select private.is_admin()));
create policy question_options_admin_update on public.question_options
for update to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy question_options_admin_delete on public.question_options
for delete to authenticated using ((select private.is_admin()));

drop policy if exists question_exam_categories_admin_manage on public.question_exam_categories;
create policy question_exam_categories_admin_insert on public.question_exam_categories
for insert to authenticated with check ((select private.is_admin()));
create policy question_exam_categories_admin_update on public.question_exam_categories
for update to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy question_exam_categories_admin_delete on public.question_exam_categories
for delete to authenticated using ((select private.is_admin()));

-- Cover foreign-key access paths and joins identified by the database linter.
create index if not exists subjects_school_class_id_idx
  on public.subjects(school_class_id);
create index if not exists topics_parent_subject_idx
  on public.topics(parent_id, subject_id);
create index if not exists questions_topic_subject_idx
  on public.questions(topic_id, subject_id);
create index if not exists questions_created_by_idx
  on public.questions(created_by);
create index if not exists question_attempts_session_id_idx
  on public.question_attempts(session_id);
create index if not exists bookmarks_question_id_idx
  on public.bookmarks(question_id);
create index if not exists question_exam_categories_exam_category_id_idx
  on public.question_exam_categories(exam_category_id);
create index if not exists private_question_answer_keys_correct_option_id_idx
  on private.question_answer_keys(correct_option_id);
