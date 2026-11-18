-- SYNAPTYL admin dashboard, contact records and protected question management.
alter table public.profiles
  add column if not exists username text unique not null
    default ('SYN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  add column if not exists contact_phone text,
  add column if not exists age_group text check (age_group in ('under_18', '18_plus')),
  add column if not exists guardian_name text,
  add column if not exists guardian_email text,
  add column if not exists guardian_phone text,
  add column if not exists guardian_consent_status text not null default 'not_required'
    check (guardian_consent_status in ('not_required', 'pending_verification', 'verified', 'rejected')),
  add column if not exists guardian_consent_at timestamptz,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_opt_in_at timestamptz,
  add column if not exists marketing_consent_version text,
  add column if not exists marketing_channels text[] not null default array[]::text[],
  add column if not exists preferred_contact_method text not null default 'email'
    check (preferred_contact_method in ('email', 'sms', 'whatsapp'));

alter table public.profiles
  add constraint profiles_marketing_channels_check
  check (marketing_channels <@ array['email', 'sms', 'whatsapp']::text[]);

create table if not exists private.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('marketing', 'guardian_processing')),
  granted boolean not null,
  consent_version text not null,
  actor_type text not null check (actor_type in ('adult_user', 'parent_guardian', 'admin')),
  recorded_at timestamptz not null default now(),
  verification_note text
);
alter table private.consent_events enable row level security;
revoke all on private.consent_events from public, anon, authenticated;
grant select, insert on private.consent_events to service_role;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_age_group text := case
    when new.raw_user_meta_data ->> 'age_group' in ('under_18', '18_plus')
      then new.raw_user_meta_data ->> 'age_group' else null end;
  v_guardian_consent boolean := coalesce((new.raw_user_meta_data ->> 'guardian_consent')::boolean, false);
  v_marketing_consent boolean := coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false);
  v_channels text[] := array[]::text[];
  v_user_name text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'guardian_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Learner'
  );
begin
  select coalesce(array_agg(value), array[]::text[]) into v_channels
  from jsonb_array_elements_text(
    case when jsonb_typeof(new.raw_user_meta_data -> 'marketing_channels') = 'array'
      then new.raw_user_meta_data -> 'marketing_channels' else '[]'::jsonb end
  ) as channel(value)
  where value in ('email', 'sms', 'whatsapp');

  insert into public.profiles (
    id, display_name, contact_phone, age_group, guardian_name, guardian_email, guardian_phone,
    guardian_consent_status, guardian_consent_at, marketing_opt_in, marketing_opt_in_at,
    marketing_consent_version, marketing_channels, preferred_contact_method
  )
  values (
    new.id, v_user_name,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'contact_phone'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'guardian_phone'), '')),
    v_age_group,
    nullif(trim(new.raw_user_meta_data ->> 'guardian_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'guardian_email'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'guardian_phone'), ''),
    case when v_age_group = 'under_18' and v_guardian_consent then 'pending_verification'
      when v_age_group = 'under_18' then 'rejected' else 'not_required' end,
    case when v_age_group = 'under_18' and v_guardian_consent then now() else null end,
    v_marketing_consent,
    case when v_marketing_consent then now() else null end,
    case when v_marketing_consent then 'synaptyl-marketing-v1-2026-11' else null end,
    v_channels,
    case when new.raw_user_meta_data ->> 'preferred_contact_method' in ('email', 'sms', 'whatsapp')
      then new.raw_user_meta_data ->> 'preferred_contact_method' else 'email' end
  )
  on conflict (id) do nothing;

  if v_marketing_consent then
    insert into private.consent_events (user_id, consent_type, granted, consent_version, actor_type)
    values (new.id, 'marketing', true, 'synaptyl-marketing-v1-2026-11',
      case when v_age_group = 'under_18' then 'parent_guardian' else 'adult_user' end);
  end if;

  if v_age_group = 'under_18' then
    insert into private.consent_events (user_id, consent_type, granted, consent_version, actor_type)
    values (new.id, 'guardian_processing', v_guardian_consent,
      'synaptyl-guardian-v1-2026-11', 'parent_guardian');
  end if;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create or replace function public.current_user_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_admin(); $$;
revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function public.admin_get_overview()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'total_questions', (select count(*) from public.questions),
    'published_questions', (select count(*) from public.questions where status = 'published'),
    'draft_questions', (select count(*) from public.questions where status = 'draft'),
    'archived_questions', (select count(*) from public.questions where status = 'archived'),
    'k12_questions', (select count(*) from public.questions q join public.subjects s on s.id=q.subject_id where s.track='k12'),
    'gkgs_questions', (select count(*) from public.questions q join public.subjects s on s.id=q.subject_id where s.track='gk_gs'),
    'marketing_opt_ins', (select count(*) from public.profiles where marketing_opt_in),
    'guardian_verification_pending', (select count(*) from public.profiles where age_group='under_18' and guardian_consent_status='pending_verification')
  );
end;
$$;
revoke all on function public.admin_get_overview() from public, anon;
grant execute on function public.admin_get_overview() to authenticated;

create or replace function public.admin_list_questions(
  p_track text default null, p_status text default null, p_search text default null,
  p_limit integer default 50, p_offset integer default 0
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_data jsonb;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(row_data.item order by row_data.created_at desc), '[]'::jsonb)
  into v_data
  from (
    select q.created_at,
      jsonb_build_object(
        'id', q.id, 'track', s.track, 'class_number', sc.class_number,
        'subject_id', q.subject_id, 'subject_name', s.name,
        'topic_id', q.topic_id, 'topic_name', t.name,
        'question_type', q.question_type, 'prompt', q.prompt, 'content', q.content,
        'difficulty', q.difficulty, 'status', q.status, 'marks', q.marks,
        'negative_marks', q.negative_marks, 'language_code', q.language_code,
        'created_at', q.created_at, 'updated_at', q.updated_at,
        'options', coalesce((select jsonb_agg(jsonb_build_object(
          'id', qo.id, 'text', qo.option_text, 'content', qo.content, 'sort_order', qo.sort_order
        ) order by qo.sort_order) from public.question_options qo where qo.question_id=q.id), '[]'::jsonb),
        'correct_option_id', ak.correct_option_id, 'accepted_answers', ak.accepted_answers,
        'grading_rules', ak.grading_rules, 'explanation', sol.explanation,
        'solution_content', sol.solution_content,
        'exam_category_ids', coalesce((select jsonb_agg(qec.exam_category_id)
          from public.question_exam_categories qec where qec.question_id=q.id), '[]'::jsonb),
        'exam_categories', coalesce((select jsonb_agg(ec.name order by ec.sort_order)
          from public.question_exam_categories qec join public.exam_categories ec on ec.id=qec.exam_category_id
          where qec.question_id=q.id), '[]'::jsonb)
      ) as item
    from public.questions q
    join public.subjects s on s.id=q.subject_id
    left join public.school_classes sc on sc.id=s.school_class_id
    join public.topics t on t.id=q.topic_id
    left join private.question_answer_keys ak on ak.question_id=q.id
    left join private.question_solutions sol on sol.question_id=q.id
    where (p_track is null or s.track::text=p_track)
      and (p_status is null or q.status=p_status)
      and (p_search is null or p_search='' or q.prompt ilike '%'||p_search||'%'
        or s.name ilike '%'||p_search||'%' or t.name ilike '%'||p_search||'%')
    order by q.created_at desc
    limit greatest(1,least(coalesce(p_limit,50),100))
    offset greatest(0,coalesce(p_offset,0))
  ) row_data;
  return v_data;
end;
$$;
revoke all on function public.admin_list_questions(text,text,text,integer,integer) from public, anon;
grant execute on function public.admin_list_questions(text,text,text,integer,integer) to authenticated;

create or replace function public.admin_save_question(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid; v_subject_id uuid; v_topic_id uuid; v_type text; v_status text; v_prompt text;
  v_options jsonb; v_accepted jsonb; v_correct_index integer; v_option_id uuid;
  v_correct_option_id uuid := null; v_exam_id uuid; v_idx integer := 0;
  v_marks numeric(8,2); v_negative numeric(8,2); v_track text; v_item jsonb;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  v_subject_id := nullif(p_payload->>'subject_id','')::uuid;
  v_topic_id := nullif(p_payload->>'topic_id','')::uuid;
  v_type := p_payload->>'question_type';
  v_status := coalesce(p_payload->>'status','draft');
  v_prompt := nullif(trim(p_payload->>'prompt'),'');
  v_options := coalesce(p_payload->'options','[]'::jsonb);
  v_accepted := coalesce(p_payload->'accepted_answers','[]'::jsonb);
  v_correct_index := nullif(p_payload->>'correct_option_index','')::integer;
  v_marks := coalesce(nullif(p_payload->>'marks','')::numeric,1);
  v_negative := coalesce(nullif(p_payload->>'negative_marks','')::numeric,0);

  if v_subject_id is null or v_topic_id is null or v_prompt is null then raise exception 'Subject, topic and question text are required'; end if;
  if v_type not in ('mcq','written','numerical') then raise exception 'Unsupported question type'; end if;
  if v_status not in ('draft','published') then raise exception 'Status must be draft or published'; end if;
  if jsonb_typeof(v_options)<>'array' or jsonb_typeof(v_accepted)<>'array' then raise exception 'Options and accepted answers must be arrays'; end if;
  if v_marks<0 or v_negative<0 then raise exception 'Marks cannot be negative'; end if;
  if v_type='mcq' then
    if jsonb_array_length(v_options)<2 then raise exception 'MCQ questions need at least two options'; end if;
    if v_correct_index is null or v_correct_index<0 or v_correct_index>=jsonb_array_length(v_options) then raise exception 'Select the correct MCQ option'; end if;
  elsif jsonb_array_length(v_accepted)=0 then raise exception 'Provide at least one accepted answer'; end if;

  select s.track::text into v_track
  from public.subjects s join public.topics t on t.subject_id=s.id
  where s.id=v_subject_id and t.id=v_topic_id;
  if v_track is null then raise exception 'The selected topic does not belong to the selected subject'; end if;

  if nullif(p_payload->>'id','') is not null then
    v_id := (p_payload->>'id')::uuid;
    if not exists(select 1 from public.questions where id=v_id) then raise exception 'Question not found'; end if;
    update public.questions set
      subject_id=v_subject_id, topic_id=v_topic_id, question_type=v_type, prompt=v_prompt,
      content=coalesce(p_payload->'content','{}'::jsonb),
      difficulty=coalesce(p_payload->>'difficulty','medium'), status=v_status,
      marks=v_marks, negative_marks=v_negative, language_code=coalesce(p_payload->>'language_code','en'),
      published_at=case when v_status='published' then coalesce(published_at,now()) else null end
    where id=v_id;
    delete from public.question_options where question_id=v_id;
  else
    insert into public.questions(subject_id,topic_id,question_type,prompt,content,difficulty,status,marks,negative_marks,language_code,created_by,published_at)
    values(v_subject_id,v_topic_id,v_type,v_prompt,coalesce(p_payload->'content','{}'::jsonb),
      coalesce(p_payload->>'difficulty','medium'),v_status,v_marks,v_negative,
      coalesce(p_payload->>'language_code','en'),auth.uid(),case when v_status='published' then now() else null end)
    returning id into v_id;
  end if;

  if v_type='mcq' then
    for v_item in select value from jsonb_array_elements(v_options) loop
      if nullif(trim(v_item->>'text'),'') is null then raise exception 'MCQ option text cannot be empty'; end if;
      insert into public.question_options(question_id,option_text,content,sort_order)
      values(v_id,trim(v_item->>'text'),coalesce(v_item->'content','{}'::jsonb),v_idx)
      returning id into v_option_id;
      if v_idx=v_correct_index then v_correct_option_id:=v_option_id; end if;
      v_idx:=v_idx+1;
    end loop;
  end if;

  insert into private.question_answer_keys(question_id,correct_option_id,accepted_answers,grading_rules,updated_at)
  values(v_id,v_correct_option_id,v_accepted,coalesce(p_payload->'grading_rules','{}'::jsonb),now())
  on conflict(question_id) do update set
    correct_option_id=excluded.correct_option_id, accepted_answers=excluded.accepted_answers,
    grading_rules=excluded.grading_rules, updated_at=now();

  insert into private.question_solutions(question_id,explanation,solution_content,updated_at)
  values(v_id,nullif(trim(p_payload->>'explanation'),''),coalesce(p_payload->'solution_content','{}'::jsonb),now())
  on conflict(question_id) do update set explanation=excluded.explanation,
    solution_content=excluded.solution_content, updated_at=now();

  delete from public.question_exam_categories where question_id=v_id;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'exam_category_ids','[]'::jsonb)) loop
    v_exam_id := (v_item#>>'{}')::uuid;
    insert into public.question_exam_categories(question_id,exam_category_id)
    values(v_id,v_exam_id) on conflict do nothing;
  end loop;
  return jsonb_build_object('id',v_id,'status',v_status,'track',v_track);
end;
$$;
revoke all on function public.admin_save_question(jsonb) from public, anon;
grant execute on function public.admin_save_question(jsonb) to authenticated;

create or replace function public.admin_archive_question(p_question_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  update public.questions set status='archived',published_at=null where id=p_question_id;
  return found;
end;
$$;
revoke all on function public.admin_archive_question(uuid) from public, anon;
grant execute on function public.admin_archive_question(uuid) to authenticated;

create or replace function public.admin_list_contact_requests(p_status text default 'all')
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_data jsonb;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',p.id,'username',p.username,'display_name',p.display_name,'email',u.email,
    'age_group',p.age_group,'contact_phone',p.contact_phone,'guardian_name',p.guardian_name,
    'guardian_email',p.guardian_email,'guardian_phone',p.guardian_phone,
    'guardian_consent_status',p.guardian_consent_status,
    'marketing_opt_in',p.marketing_opt_in,'marketing_opt_in_at',p.marketing_opt_in_at,
    'marketing_channels',p.marketing_channels,'preferred_contact_method',p.preferred_contact_method,
    'created_at',p.created_at
  ) order by p.created_at desc),'[]'::jsonb) into v_data
  from public.profiles p join auth.users u on u.id=p.id
  where p_status='all'
    or (p_status='pending' and p.age_group='under_18' and p.guardian_consent_status='pending_verification')
    or (p_status='eligible' and p.marketing_opt_in and (
      p.age_group='18_plus' or (p.age_group='under_18' and p.guardian_consent_status='verified')
    ))
    or (p_status='not_opted_in' and not p.marketing_opt_in);
  return v_data;
end;
$$;
revoke all on function public.admin_list_contact_requests(text) from public, anon;
grant execute on function public.admin_list_contact_requests(text) to authenticated;

create or replace function public.admin_set_guardian_consent(p_user_id uuid,p_verified boolean,p_note text default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_exists boolean;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  update public.profiles set
    guardian_consent_status=case when p_verified then 'verified' else 'rejected' end,
    guardian_consent_at=case when p_verified then coalesce(guardian_consent_at,now()) else null end
  where id=p_user_id and age_group='under_18';
  v_exists:=found;
  if v_exists then
    insert into private.consent_events(user_id,consent_type,granted,consent_version,actor_type,verification_note)
    values(p_user_id,'guardian_processing',p_verified,'synaptyl-guardian-v1-2026-11','admin',nullif(trim(p_note),''));
  end if;
  return v_exists;
end;
$$;
revoke all on function public.admin_set_guardian_consent(uuid,boolean,text) from public, anon;
grant execute on function public.admin_set_guardian_consent(uuid,boolean,text) to authenticated;
