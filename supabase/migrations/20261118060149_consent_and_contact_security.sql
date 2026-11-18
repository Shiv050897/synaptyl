-- Adult preferences and guardian contact are separate. Under-18 accounts never enter marketing audiences.
alter table public.profiles
  add column if not exists guardian_marketing_opt_in boolean not null default false,
  add column if not exists guardian_marketing_opt_in_at timestamptz,
  add column if not exists guardian_marketing_channels text[] not null default array[]::text[];

alter table public.profiles
  add constraint profiles_guardian_marketing_channels_check
  check (guardian_marketing_channels <@ array['email','sms','whatsapp']::text[]);

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_age_group text := case when new.raw_user_meta_data->>'age_group' in ('under_18','18_plus')
    then new.raw_user_meta_data->>'age_group' else null end;
  v_guardian_consent boolean := coalesce((new.raw_user_meta_data->>'guardian_consent')::boolean,false);
  v_adult_marketing boolean := coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean,false);
  v_guardian_marketing boolean := coalesce((new.raw_user_meta_data->>'guardian_marketing_opt_in')::boolean,false);
  v_channels text[] := array[]::text[];
  v_user_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),
    nullif(trim(new.raw_user_meta_data->>'guardian_name'),''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),'Learner');
begin
  select coalesce(array_agg(value),array[]::text[]) into v_channels
  from jsonb_array_elements_text(
    case when jsonb_typeof(new.raw_user_meta_data->'marketing_channels')='array'
      then new.raw_user_meta_data->'marketing_channels' else '[]'::jsonb end
  ) as channel(value)
  where value in ('email','sms','whatsapp');

  insert into public.profiles (
    id,display_name,contact_phone,age_group,guardian_name,guardian_email,guardian_phone,
    guardian_consent_status,guardian_consent_at,marketing_opt_in,marketing_opt_in_at,
    marketing_consent_version,marketing_channels,guardian_marketing_opt_in,
    guardian_marketing_opt_in_at,guardian_marketing_channels,preferred_contact_method
  )
  values (
    new.id,v_user_name,
    case when v_age_group='18_plus' then nullif(trim(new.raw_user_meta_data->>'contact_phone'),'') else null end,
    v_age_group,
    nullif(trim(new.raw_user_meta_data->>'guardian_name'),''),
    case when v_age_group='under_18' then new.email else null end,
    case when v_age_group='under_18' then nullif(trim(new.raw_user_meta_data->>'guardian_phone'),'') else null end,
    case when v_age_group='under_18' and v_guardian_consent then 'pending_verification'
      when v_age_group='under_18' then 'rejected' else 'not_required' end,
    case when v_age_group='under_18' and v_guardian_consent then now() else null end,
    (v_age_group='18_plus' and v_adult_marketing),
    case when v_age_group='18_plus' and v_adult_marketing then now() else null end,
    case when v_age_group='18_plus' and v_adult_marketing then 'synaptyl-marketing-v1-2026-11' else null end,
    case when v_age_group='18_plus' and v_adult_marketing then v_channels else array[]::text[] end,
    (v_age_group='under_18' and v_guardian_consent and v_guardian_marketing),
    case when v_age_group='under_18' and v_guardian_consent and v_guardian_marketing then now() else null end,
    case when v_age_group='under_18' and v_guardian_consent and v_guardian_marketing then v_channels else array[]::text[] end,
    case when new.raw_user_meta_data->>'preferred_contact_method' in ('email','sms','whatsapp')
      then new.raw_user_meta_data->>'preferred_contact_method' else 'email' end
  ) on conflict(id) do nothing;

  if v_age_group='18_plus' and v_adult_marketing then
    insert into private.consent_events(user_id,consent_type,granted,consent_version,actor_type)
    values(new.id,'marketing',true,'synaptyl-marketing-v1-2026-11','adult_user');
  end if;
  if v_age_group='under_18' then
    insert into private.consent_events(user_id,consent_type,granted,consent_version,actor_type)
    values(new.id,'guardian_processing',v_guardian_consent,'synaptyl-guardian-v1-2026-11','parent_guardian');
  end if;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public,anon,authenticated;

revoke update on public.profiles from authenticated;
grant update(display_name,avatar_url,contact_phone,preferred_contact_method)
  on public.profiles to authenticated;

create or replace function public.update_my_marketing_preference(p_opt_in boolean,p_channels text[] default array['email']::text[])
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_age_group text; v_user_id uuid:=auth.uid(); v_channels text[];
begin
  if v_user_id is null then raise exception 'Sign-in required' using errcode='42501'; end if;
  if coalesce(array_length(p_channels,1),0)>3 or not (coalesce(p_channels,array[]::text[]) <@ array['email','sms','whatsapp']::text[])
    then raise exception 'Invalid contact channel'; end if;
  select age_group into v_age_group from public.profiles where id=v_user_id for update;
  if v_age_group='18_plus' then
    update public.profiles set marketing_opt_in=p_opt_in,
      marketing_opt_in_at=case when p_opt_in then now() else null end,
      marketing_consent_version=case when p_opt_in then 'synaptyl-marketing-v1-2026-11' else null end,
      marketing_channels=case when p_opt_in then coalesce(p_channels,array[]::text[]) else array[]::text[] end
    where id=v_user_id;
    insert into private.consent_events(user_id,consent_type,granted,consent_version,actor_type)
    values(v_user_id,'marketing',p_opt_in,'synaptyl-marketing-v1-2026-11','adult_user');
  elsif v_age_group='under_18' then
    raise exception 'Promotional messages are not available to under-18 learner accounts';
  else
    raise exception 'Age group must be recorded before marketing preferences can be set';
  end if;
  return p_opt_in;
end;
$$;
revoke all on function public.update_my_marketing_preference(boolean,text[]) from public,anon;
grant execute on function public.update_my_marketing_preference(boolean,text[]) to authenticated;
