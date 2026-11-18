-- Do not expose K-12 personal learning features until guardian consent has been verified.
create or replace function private.has_active_learner_access()
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.profiles p where p.id=(select auth.uid())
      and (p.age_group='18_plus' or (p.age_group='under_18' and p.guardian_consent_status='verified'))
  );
$$;
revoke all on function private.has_active_learner_access() from public,anon;
grant execute on function private.has_active_learner_access() to authenticated;

drop policy if exists school_classes_read on public.school_classes;
create policy school_classes_read on public.school_classes for select to authenticated using ((select private.has_active_learner_access()));
drop policy if exists exam_categories_read on public.exam_categories;
create policy exam_categories_read on public.exam_categories for select to authenticated using ((select private.has_active_learner_access()));
drop policy if exists subjects_read on public.subjects;
create policy subjects_read on public.subjects for select to authenticated using ((select private.has_active_learner_access()));
drop policy if exists topics_read on public.topics;
create policy topics_read on public.topics for select to authenticated using ((select private.has_active_learner_access()));
drop policy if exists questions_read_published_or_admin on public.questions;
create policy questions_read_published_or_admin on public.questions for select to authenticated using (
  (status='published' and (select private.has_active_learner_access())) or (select private.is_admin())
);
drop policy if exists question_options_read_published_or_admin on public.question_options;
create policy question_options_read_published_or_admin on public.question_options for select to authenticated using (
  (select private.is_admin()) or ((select private.has_active_learner_access())
    and exists(select 1 from public.questions q where q.id=question_id and q.status='published'))
);
drop policy if exists question_exam_categories_read_published_or_admin on public.question_exam_categories;
create policy question_exam_categories_read_published_or_admin on public.question_exam_categories for select to authenticated using (
  (select private.is_admin()) or ((select private.has_active_learner_access())
    and exists(select 1 from public.questions q where q.id=question_id and q.status='published'))
);

drop policy if exists practice_sessions_select_own on public.practice_sessions;
create policy practice_sessions_select_own on public.practice_sessions for select to authenticated
using(user_id=(select auth.uid()) and (select private.has_active_learner_access()));
drop policy if exists practice_sessions_insert_own on public.practice_sessions;
create policy practice_sessions_insert_own on public.practice_sessions for insert to authenticated
with check(user_id=(select auth.uid()) and (select private.has_active_learner_access()));
drop policy if exists practice_sessions_update_own on public.practice_sessions;
create policy practice_sessions_update_own on public.practice_sessions for update to authenticated
using(user_id=(select auth.uid()) and (select private.has_active_learner_access()))
with check(user_id=(select auth.uid()) and (select private.has_active_learner_access()));

drop policy if exists question_attempts_select_own on public.question_attempts;
create policy question_attempts_select_own on public.question_attempts for select to authenticated
using(user_id=(select auth.uid()) and (select private.has_active_learner_access()));
drop policy if exists question_attempts_insert_own on public.question_attempts;
create policy question_attempts_insert_own on public.question_attempts for insert to authenticated
with check(user_id=(select auth.uid()) and (select private.has_active_learner_access())
  and exists(select 1 from public.practice_sessions ps where ps.id=session_id and ps.user_id=(select auth.uid()))
  and exists(select 1 from public.questions q where q.id=question_id and q.status='published'));

drop policy if exists bookmarks_select_own on public.bookmarks;
create policy bookmarks_select_own on public.bookmarks for select to authenticated
using(user_id=(select auth.uid()) and (select private.has_active_learner_access()));
drop policy if exists bookmarks_insert_own on public.bookmarks;
create policy bookmarks_insert_own on public.bookmarks for insert to authenticated
with check(user_id=(select auth.uid()) and (select private.has_active_learner_access())
  and exists(select 1 from public.questions q where q.id=question_id and q.status='published'));

-- Only adults who explicitly opted in are returned from the marketing contact function.
create or replace function public.admin_list_contact_requests(p_status text default 'eligible')
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_data jsonb;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',p.id,'username',p.username,'display_name',p.display_name,'email',u.email,
    'contact_phone',p.contact_phone,'marketing_opt_in',p.marketing_opt_in,
    'marketing_opt_in_at',p.marketing_opt_in_at,'marketing_channels',p.marketing_channels,
    'preferred_contact_method',p.preferred_contact_method,'created_at',p.created_at
  ) order by p.marketing_opt_in_at desc),'[]'::jsonb)
  into v_data from public.profiles p join auth.users u on u.id=p.id
  where p.age_group='18_plus' and p.marketing_opt_in=true and p_status in ('eligible','all');
  return v_data;
end;
$$;
revoke all on function public.admin_list_contact_requests(text) from public,anon;
grant execute on function public.admin_list_contact_requests(text) to authenticated;

create or replace function public.admin_list_guardian_review()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_data jsonb;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',p.id,'username',p.username,'display_name',p.display_name,'guardian_name',p.guardian_name,
    'guardian_email',p.guardian_email,'guardian_phone',p.guardian_phone,
    'guardian_consent_status',p.guardian_consent_status,'guardian_consent_at',p.guardian_consent_at,
    'created_at',p.created_at
  ) order by p.created_at desc),'[]'::jsonb)
  into v_data from public.profiles p
  where p.age_group='under_18' and p.guardian_consent_status='pending_verification';
  return v_data;
end;
$$;
revoke all on function public.admin_list_guardian_review() from public,anon;
grant execute on function public.admin_list_guardian_review() to authenticated;

create or replace function public.admin_set_guardian_consent(p_user_id uuid,p_verified boolean,p_note text default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_exists boolean;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_verified and nullif(trim(p_note),'') is null then raise exception 'Record how guardian consent was verified'; end if;
  update public.profiles set guardian_consent_status=case when p_verified then 'verified' else 'rejected' end,
    guardian_consent_at=case when p_verified then now() else null end,
    guardian_marketing_opt_in=false,guardian_marketing_opt_in_at=null,guardian_marketing_channels=array[]::text[]
  where id=p_user_id and age_group='under_18';
  v_exists:=found;
  if v_exists then insert into private.consent_events(user_id,consent_type,granted,consent_version,actor_type,verification_note)
    values(p_user_id,'guardian_processing',p_verified,'synaptyl-guardian-v1-2026-11','admin',nullif(trim(p_note),''));
  end if;
  return v_exists;
end;
$$;
revoke all on function public.admin_set_guardian_consent(uuid,boolean,text) from public,anon;
grant execute on function public.admin_set_guardian_consent(uuid,boolean,text) to authenticated;

create or replace function public.update_my_marketing_preference(p_opt_in boolean,p_channels text[] default array['email']::text[])
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_age_group text; v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'Sign-in required' using errcode='42501'; end if;
  if not (coalesce(p_channels,array[]::text[]) <@ array['email','sms','whatsapp']::text[]) then raise exception 'Invalid contact channel'; end if;
  select age_group into v_age_group from public.profiles where id=v_user_id for update;
  if v_age_group<>'18_plus' then raise exception 'Promotional messages are not available to under-18 learner accounts'; end if;
  update public.profiles set marketing_opt_in=p_opt_in,
    marketing_opt_in_at=case when p_opt_in then now() else null end,
    marketing_consent_version=case when p_opt_in then 'synaptyl-marketing-v1-2026-11' else null end,
    marketing_channels=case when p_opt_in then coalesce(p_channels,array[]::text[]) else array[]::text[] end
  where id=v_user_id;
  insert into private.consent_events(user_id,consent_type,granted,consent_version,actor_type)
  values(v_user_id,'marketing',p_opt_in,'synaptyl-marketing-v1-2026-11','adult_user');
  return p_opt_in;
end;
$$;
revoke all on function public.update_my_marketing_preference(boolean,text[]) from public,anon;
grant execute on function public.update_my_marketing_preference(boolean,text[]) to authenticated;
