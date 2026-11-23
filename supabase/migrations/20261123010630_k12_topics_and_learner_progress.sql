-- 1) Every K-12 subject gets a starting topic, so questions can be added and
--    practised straight away. Admins can add chapter topics in the admin panel.
insert into public.topics (subject_id, name, slug, description, display_order)
select s.id, 'General practice', 'general-practice', 'Mixed questions across the subject', 0
from public.subjects s
where s.track = 'k12'
on conflict (subject_id, slug) do nothing;

-- 2) A learner's own progress, totalled per subject. Reads only the caller's
--    own attempts; grades stay in the protected schema.
create or replace function public.my_progress()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign-in required' using errcode = '42501'; end if;
  if not private.has_active_learner_access() then
    raise exception 'Learning access is not enabled for this account' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'sessions', (select count(*) from public.practice_sessions ps where ps.user_id = v_uid),
    'attempted', (select count(*) from public.question_attempts qa where qa.user_id = v_uid),
    'correct', (select count(*) from public.question_attempts qa
                join private.question_attempt_grades g on g.attempt_id = qa.id
                where qa.user_id = v_uid and g.is_correct),
    'graded', (select count(*) from public.question_attempts qa
               join private.question_attempt_grades g on g.attempt_id = qa.id
               where qa.user_id = v_uid and g.is_correct is not null),
    'last_practised_at', (select max(qa.submitted_at) from public.question_attempts qa where qa.user_id = v_uid),
    'subjects', coalesce((
      select jsonb_agg(row_to_json(t) order by t.last_at desc)
      from (
        -- School subjects are grouped by subject; GK & GS by topic.
        select s.track, sc.class_number,
               case when s.track = 'gk_gs' then tp.name else s.name end as subject,
               count(*) as attempted,
               count(*) filter (where g.is_correct) as correct,
               count(*) filter (where g.is_correct is not null) as graded,
               max(qa.submitted_at) as last_at
        from public.question_attempts qa
        join public.questions q on q.id = qa.question_id
        join public.subjects s on s.id = q.subject_id
        join public.topics tp on tp.id = q.topic_id
        left join public.school_classes sc on sc.id = s.school_class_id
        left join private.question_attempt_grades g on g.attempt_id = qa.id
        where qa.user_id = v_uid
        group by s.track, sc.class_number, case when s.track = 'gk_gs' then tp.name else s.name end
      ) t
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.my_progress() from public, anon;
grant execute on function public.my_progress() to authenticated;
