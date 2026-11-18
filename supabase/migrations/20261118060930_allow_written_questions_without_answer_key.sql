-- Written responses are stored for review; they do not require a machine-answer key.
create or replace function public.admin_save_question(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid; v_subject_id uuid; v_topic_id uuid; v_type text; v_status text; v_prompt text;
  v_options jsonb; v_accepted jsonb; v_correct_index integer; v_option_id uuid;
  v_correct_option_id uuid := null; v_exam_id uuid; v_idx integer := 0;
  v_marks numeric(8,2); v_negative numeric(8,2); v_track text; v_item jsonb;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  v_subject_id:=nullif(p_payload->>'subject_id','')::uuid;
  v_topic_id:=nullif(p_payload->>'topic_id','')::uuid;
  v_type:=p_payload->>'question_type';
  v_status:=coalesce(p_payload->>'status','draft');
  v_prompt:=nullif(trim(p_payload->>'prompt'),'');
  v_options:=coalesce(p_payload->'options','[]'::jsonb);
  v_accepted:=coalesce(p_payload->'accepted_answers','[]'::jsonb);
  v_correct_index:=nullif(p_payload->>'correct_option_index','')::integer;
  v_marks:=coalesce(nullif(p_payload->>'marks','')::numeric,1);
  v_negative:=coalesce(nullif(p_payload->>'negative_marks','')::numeric,0);
  if v_subject_id is null or v_topic_id is null or v_prompt is null then raise exception 'Subject, topic and question text are required'; end if;
  if v_type not in ('mcq','written','numerical') then raise exception 'Unsupported question type'; end if;
  if v_status not in ('draft','published') then raise exception 'Status must be draft or published'; end if;
  if jsonb_typeof(v_options)<>'array' or jsonb_typeof(v_accepted)<>'array' then raise exception 'Options and accepted answers must be arrays'; end if;
  if v_marks<0 or v_negative<0 then raise exception 'Marks cannot be negative'; end if;
  if v_type='mcq' then
    if jsonb_array_length(v_options)<2 then raise exception 'MCQ questions need at least two options'; end if;
    if v_correct_index is null or v_correct_index<0 or v_correct_index>=jsonb_array_length(v_options) then raise exception 'Select the correct MCQ option'; end if;
  elsif v_type='numerical' and jsonb_array_length(v_accepted)=0 then
    raise exception 'Provide at least one accepted numerical answer';
  end if;
  select s.track::text into v_track from public.subjects s join public.topics t on t.subject_id=s.id
    where s.id=v_subject_id and t.id=v_topic_id;
  if v_track is null then raise exception 'The selected topic does not belong to the selected subject'; end if;
  if nullif(p_payload->>'id','') is not null then
    v_id:=(p_payload->>'id')::uuid;
    if not exists(select 1 from public.questions where id=v_id) then raise exception 'Question not found'; end if;
    update public.questions set subject_id=v_subject_id,topic_id=v_topic_id,question_type=v_type,prompt=v_prompt,
      content=coalesce(p_payload->'content','{}'::jsonb),difficulty=coalesce(p_payload->>'difficulty','medium'),
      status=v_status,marks=v_marks,negative_marks=v_negative,language_code=coalesce(p_payload->>'language_code','en'),
      published_at=case when v_status='published' then coalesce(published_at,now()) else null end
      where id=v_id;
    delete from public.question_options where question_id=v_id;
  else
    insert into public.questions(subject_id,topic_id,question_type,prompt,content,difficulty,status,marks,negative_marks,language_code,created_by,published_at)
    values(v_subject_id,v_topic_id,v_type,v_prompt,coalesce(p_payload->'content','{}'::jsonb),
      coalesce(p_payload->>'difficulty','medium'),v_status,v_marks,v_negative,coalesce(p_payload->>'language_code','en'),
      auth.uid(),case when v_status='published' then now() else null end) returning id into v_id;
  end if;
  if v_type='mcq' then
    for v_item in select value from jsonb_array_elements(v_options) loop
      if nullif(trim(v_item->>'text'),'') is null then raise exception 'MCQ option text cannot be empty'; end if;
      insert into public.question_options(question_id,option_text,content,sort_order)
      values(v_id,trim(v_item->>'text'),coalesce(v_item->'content','{}'::jsonb),v_idx) returning id into v_option_id;
      if v_idx=v_correct_index then v_correct_option_id:=v_option_id; end if;
      v_idx:=v_idx+1;
    end loop;
  end if;
  insert into private.question_answer_keys(question_id,correct_option_id,accepted_answers,grading_rules,updated_at)
    values(v_id,v_correct_option_id,v_accepted,coalesce(p_payload->'grading_rules','{}'::jsonb),now())
    on conflict(question_id) do update set correct_option_id=excluded.correct_option_id,
      accepted_answers=excluded.accepted_answers,grading_rules=excluded.grading_rules,updated_at=now();
  insert into private.question_solutions(question_id,explanation,solution_content,updated_at)
    values(v_id,nullif(trim(p_payload->>'explanation'),''),coalesce(p_payload->'solution_content','{}'::jsonb),now())
    on conflict(question_id) do update set explanation=excluded.explanation,
      solution_content=excluded.solution_content,updated_at=now();
  delete from public.question_exam_categories where question_id=v_id;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'exam_category_ids','[]'::jsonb)) loop
    v_exam_id:=(v_item#>>'{}')::uuid;
    insert into public.question_exam_categories(question_id,exam_category_id) values(v_id,v_exam_id) on conflict do nothing;
  end loop;
  return jsonb_build_object('id',v_id,'status',v_status,'track',v_track);
end;
$$;
revoke all on function public.admin_save_question(jsonb) from public,anon;
grant execute on function public.admin_save_question(jsonb) to authenticated;
