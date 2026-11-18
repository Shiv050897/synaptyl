create or replace function public.submit_question_answer(p_session_id uuid,p_question_id uuid,p_answer jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid:=auth.uid(); v_question public.questions%rowtype; v_session public.practice_sessions%rowtype;
  v_correct_option_id uuid; v_is_correct boolean:=null; v_marks_awarded numeric(8,2):=null;
  v_submitted_value text; v_expected jsonb; v_tolerance numeric:=0.0001; v_attempt_id uuid;
  v_explanation text; v_solution_content jsonb; v_status text;
begin
  if v_user_id is null then raise exception 'Sign-in required' using errcode='42501'; end if;
  if not private.has_active_learner_access() then raise exception 'Guardian verification is required before learning access is enabled' using errcode='42501'; end if;
  if p_answer is null or jsonb_typeof(p_answer)<>'object' then raise exception 'Answer payload must be an object'; end if;
  select * into v_session from public.practice_sessions where id=p_session_id and user_id=v_user_id;
  if not found then raise exception 'Practice session not found'; end if;
  select q.* into v_question from public.questions q join public.subjects s on s.id=q.subject_id
    where q.id=p_question_id and q.status='published' and s.track=v_session.track;
  if not found then raise exception 'Published question not found in this learning track'; end if;
  insert into public.question_attempts(session_id,user_id,question_id,submitted_answer)
    values(p_session_id,v_user_id,p_question_id,p_answer) returning id into v_attempt_id;
  select ak.correct_option_id,ak.accepted_answers,
    coalesce(nullif(ak.grading_rules->>'tolerance','')::numeric,0.0001)
    into v_correct_option_id,v_expected,v_tolerance
    from private.question_answer_keys ak where ak.question_id=p_question_id;
  v_tolerance:=coalesce(v_tolerance,0.0001);
  if v_question.question_type='mcq' then
    if nullif(p_answer->>'option_id','') is null then raise exception 'Choose an option before submitting'; end if;
    if not exists(select 1 from public.question_options qo where qo.id=(p_answer->>'option_id')::uuid and qo.question_id=p_question_id)
      then raise exception 'Selected option does not belong to this question'; end if;
    v_is_correct:=((p_answer->>'option_id')::uuid=v_correct_option_id);
    v_marks_awarded:=case when v_is_correct then v_question.marks else -v_question.negative_marks end;
  elsif v_question.question_type='numerical' then
    v_submitted_value:=nullif(trim(p_answer->>'value'),'');
    if v_submitted_value is null then raise exception 'Enter a numerical answer'; end if;
    v_is_correct:=exists(select 1 from jsonb_array_elements(coalesce(v_expected,'[]'::jsonb)) a(value)
      where case when trim(a.value#>>'{}') ~ '^[+-]?[0-9]+([.][0-9]+)?$' and v_submitted_value ~ '^[+-]?[0-9]+([.][0-9]+)?$'
      then abs((a.value#>>'{}')::numeric-v_submitted_value::numeric)<=v_tolerance
      else lower(trim(a.value#>>'{}'))=lower(v_submitted_value) end);
    v_marks_awarded:=case when v_is_correct then v_question.marks else -v_question.negative_marks end;
  elsif v_question.question_type='written' then
    v_submitted_value:=nullif(trim(p_answer->>'value'),'');
    if v_submitted_value is null then raise exception 'Enter your written answer'; end if;
  end if;
  insert into private.question_attempt_grades(attempt_id,is_correct,marks_awarded,feedback,graded_at)
    values(v_attempt_id,v_is_correct,v_marks_awarded,
      case when v_question.question_type='written' then jsonb_build_object('status','submitted_for_review')
      else jsonb_build_object('status','auto_graded') end,now());
  select explanation,solution_content into v_explanation,v_solution_content
    from private.question_solutions where question_id=p_question_id;
  v_status:=case when v_question.question_type='written' then 'submitted_for_review' when v_is_correct then 'correct' else 'incorrect' end;
  return jsonb_build_object('attempt_id',v_attempt_id,'question_type',v_question.question_type,'status',v_status,
    'is_correct',v_is_correct,'marks_awarded',v_marks_awarded,
    'correct_option_id',case when v_question.question_type='mcq' then v_correct_option_id else null end,
    'explanation',v_explanation,'solution_content',coalesce(v_solution_content,'{}'::jsonb));
end;
$$;
revoke all on function public.submit_question_answer(uuid,uuid,jsonb) from public,anon;
grant execute on function public.submit_question_answer(uuid,uuid,jsonb) to authenticated;
