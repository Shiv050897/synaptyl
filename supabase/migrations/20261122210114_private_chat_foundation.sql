-- Private two-person chat (X1, X2) + chat Admin.
-- Message and media CONTENT is end-to-end encrypted in the browser; the
-- database only ever stores ciphertext. These rules control who can reach
-- the encrypted rows at all.
--
-- Isolation from the learning site:
--   * Chat membership lives in private.chat_members, separate from the
--     learning-site admin table (private.user_roles). A learning admin has
--     no chat access, and chat accounts have no learning-site role.
--   * Every chat table, bucket and realtime channel checks membership, so
--     students and anonymous visitors are rejected by the database itself.

-- ---------------------------------------------------------------------------
-- Membership, settings, login throttling (private schema, not exposed)
-- ---------------------------------------------------------------------------
create table private.chat_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null unique check (role in ('x1', 'x2', 'admin')),
  username text not null,
  revoked_before timestamptz,           -- tokens issued before this are rejected
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_members_username_format
    check (username ~ '^[A-Za-z0-9_.-]{2,32}$')
);
create unique index chat_members_username_lower_idx
  on private.chat_members (lower(username));
create trigger chat_members_touch_updated_at before update on private.chat_members
for each row execute function private.touch_updated_at();

create table private.chat_settings (
  id boolean primary key default true check (id),   -- single row
  locked boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.chat_settings (id, locked) values (true, false);

create table private.chat_login_attempts (
  id bigint generated always as identity primary key,
  throttle_key text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);
create index chat_login_attempts_key_time_idx
  on private.chat_login_attempts (throttle_key, attempted_at desc);

alter table private.chat_members enable row level security;
alter table private.chat_settings enable row level security;
alter table private.chat_login_attempts enable row level security;
revoke all on private.chat_members, private.chat_settings, private.chat_login_attempts
  from public, anon, authenticated;
grant select, insert, update, delete
  on private.chat_members, private.chat_settings, private.chat_login_attempts
  to service_role;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
-- True only for X1/X2 with a token issued after any forced logout, while the
-- chat is unlocked.
create or replace function private.is_chat_member()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.chat_members m
    where m.user_id = (select auth.uid())
      and m.role in ('x1', 'x2')
      and (m.revoked_before is null
           or coalesce(((select auth.jwt()) ->> 'iat')::numeric, 0)
              > extract(epoch from m.revoked_before))
      and not coalesce((select s.locked from private.chat_settings s where s.id), false)
  );
$$;

create or replace function private.is_chat_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.chat_members m
    where m.user_id = (select auth.uid())
      and m.role = 'admin'
      and (m.revoked_before is null
           or coalesce(((select auth.jwt()) ->> 'iat')::numeric, 0)
              > extract(epoch from m.revoked_before))
  );
$$;

-- The other chat participant for the current X1/X2 user.
create or replace function private.chat_peer_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select m.user_id from private.chat_members m
  where m.role in ('x1', 'x2') and m.user_id <> (select auth.uid())
  limit 1;
$$;

revoke all on function private.is_chat_member(), private.is_chat_admin(),
  private.chat_peer_id() from public, anon;
grant execute on function private.is_chat_member(), private.is_chat_admin(),
  private.chat_peer_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Public-key directory for end-to-end encryption (ECDH P-256 public keys)
-- Private keys never leave the user's device.
-- ---------------------------------------------------------------------------
create table public.chat_keys (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  public_key jsonb not null,
  key_version integer not null default 1 check (key_version > 0),
  updated_at timestamptz not null default now(),
  constraint chat_keys_public_key_size check (octet_length(public_key::text) <= 2048)
);
create trigger chat_keys_touch_updated_at before update on public.chat_keys
for each row execute function private.touch_updated_at();

alter table public.chat_keys enable row level security;
create policy chat_keys_select_members on public.chat_keys
for select to authenticated using ((select private.is_chat_member()));
create policy chat_keys_insert_own on public.chat_keys
for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_chat_member()));
create policy chat_keys_update_own on public.chat_keys
for update to authenticated
using (user_id = (select auth.uid()) and (select private.is_chat_member()))
with check (user_id = (select auth.uid()));
grant select, insert, update on public.chat_keys to authenticated;

-- ---------------------------------------------------------------------------
-- Messages (ciphertext only)
-- ---------------------------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('text', 'voice', 'audio')),
  ciphertext text,                       -- base64 AES-GCM output; null once deleted
  iv text,                               -- base64 96-bit nonce
  sender_key_version integer,
  recipient_key_version integer,
  media_path text,                       -- encrypted blob in the chat-media bucket
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  deleted_at timestamptz,
  constraint chat_messages_not_self check (sender_id <> recipient_id),
  constraint chat_messages_ciphertext_size check (ciphertext is null or length(ciphertext) <= 100000),
  constraint chat_messages_iv_size check (iv is null or length(iv) <= 64),
  constraint chat_messages_content_present check (
    deleted_at is not null or (ciphertext is not null and iv is not null)
  ),
  constraint chat_messages_media_for_audio check (
    deleted_at is not null or (kind = 'text') = (media_path is null)
  )
);
create index chat_messages_created_idx on public.chat_messages (created_at desc);
create index chat_messages_sender_idx on public.chat_messages (sender_id);
create index chat_messages_recipient_unread_idx
  on public.chat_messages (recipient_id) where read_at is null;
create index chat_messages_reply_to_idx on public.chat_messages (reply_to_id);

alter table public.chat_messages enable row level security;
create policy chat_messages_select on public.chat_messages
for select to authenticated using (
  ((select private.is_chat_member())
    and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())))
  or (select private.is_chat_admin())
);
create policy chat_messages_insert_own on public.chat_messages
for insert to authenticated with check (
  (select private.is_chat_member())
  and sender_id = (select auth.uid())
  and recipient_id = (select private.chat_peer_id())
  and deleted_at is null and delivered_at is null and read_at is null
  and (media_path is null or media_path like ((select auth.uid())::text || '/%'))
);
-- No direct UPDATE/DELETE: receipts and deletion go through the functions below.
grant select, insert on public.chat_messages to authenticated;

alter publication supabase_realtime add table public.chat_messages;

-- Read receipts: recipient marks messages delivered/read.
create or replace function public.chat_mark_messages(p_status text, p_up_to timestamptz default now())
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if not private.is_chat_member() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_status = 'delivered' then
    update public.chat_messages set delivered_at = now()
    where recipient_id = auth.uid() and delivered_at is null and created_at <= p_up_to;
  elsif p_status = 'read' then
    update public.chat_messages
      set read_at = now(), delivered_at = coalesce(delivered_at, now())
    where recipient_id = auth.uid() and read_at is null and created_at <= p_up_to;
  else
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- "Delete for everyone": sender wipes their own message. Returns the media
-- path so the client can remove the encrypted file from storage.
create or replace function public.chat_delete_own_message(p_message_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_path text;
begin
  if not private.is_chat_member() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select media_path into v_path from public.chat_messages
  where id = p_message_id and sender_id = auth.uid() and deleted_at is null
  for update;
  if not found then
    raise exception 'Message not found' using errcode = 'P0002';
  end if;
  update public.chat_messages
    set ciphertext = null, iv = null, media_path = null, deleted_at = now()
  where id = p_message_id;
  return v_path;
end;
$$;

-- Who am I in the chat, and who is my peer (members and admin only).
create or replace function public.chat_whoami()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_me private.chat_members;
begin
  if not (private.is_chat_member() or private.is_chat_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_me from private.chat_members where user_id = auth.uid();
  return jsonb_build_object(
    'user_id', v_me.user_id,
    'role', v_me.role,
    'username', v_me.username,
    'peer', case when v_me.role in ('x1', 'x2') then (
      select jsonb_build_object('user_id', p.user_id, 'username', p.username)
      from private.chat_members p
      where p.role in ('x1', 'x2') and p.user_id <> v_me.user_id
    ) end
  );
end;
$$;

revoke all on function public.chat_mark_messages(text, timestamptz),
  public.chat_delete_own_message(uuid), public.chat_whoami() from public, anon;
grant execute on function public.chat_mark_messages(text, timestamptz),
  public.chat_delete_own_message(uuid), public.chat_whoami() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin functions (chat admin only; cannot read message content)
-- ---------------------------------------------------------------------------
create or replace function public.chat_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_chat_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'locked', (select locked from private.chat_settings where id),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'role', m.role, 'username', m.username,
        'revoked_before', m.revoked_before, 'last_sign_in_at', u.last_sign_in_at,
        'active_sessions', (select count(*) from auth.sessions s where s.user_id = m.user_id)
      ) order by m.role), '[]'::jsonb)
      from private.chat_members m join auth.users u on u.id = m.user_id
    ),
    'message_count', (select count(*) from public.chat_messages where deleted_at is null),
    'media_count', (select count(*) from public.chat_messages
                    where deleted_at is null and media_path is not null)
  );
end;
$$;

create or replace function public.chat_admin_set_username(p_user_id uuid, p_username text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_chat_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  update private.chat_members set username = trim(p_username)
  where user_id = p_user_id and role in ('x1', 'x2');
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.chat_admin_set_lock(p_locked boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_chat_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  update private.chat_settings set locked = p_locked, updated_at = now() where id;
end;
$$;

-- Immediately invalidates existing access tokens (via revoked_before) and
-- removes refresh sessions so the user cannot silently sign back in.
create or replace function public.chat_admin_force_logout(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (private.is_chat_admin() or (select auth.role()) = 'service_role') then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  update private.chat_members set revoked_before = now()
  where user_id = p_user_id and role in ('x1', 'x2');
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  delete from auth.sessions where user_id = p_user_id;
end;
$$;

-- Message metadata for the admin list (never content).
create or replace function public.chat_admin_list_messages(
  p_before timestamptz default null, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_chat_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.created_at desc) from (
      select m.id, m.kind, m.created_at, m.read_at, m.deleted_at,
             (m.media_path is not null) as has_media,
             s.username as sender, r.username as recipient
      from public.chat_messages m
      left join private.chat_members s on s.user_id = m.sender_id
      left join private.chat_members r on r.user_id = m.recipient_id
      where p_before is null or m.created_at < p_before
      order by m.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) t
  ), '[]'::jsonb);
end;
$$;

-- Permanently deletes messages (all when p_message_ids is null). Returns the
-- media paths so the admin Edge Function can delete the encrypted files.
create or replace function public.chat_admin_delete_messages(p_message_ids uuid[] default null)
returns text[] language plpgsql security definer set search_path = ''
as $$
declare v_paths text[];
begin
  if not private.is_chat_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  with removed as (
    delete from public.chat_messages
    where p_message_ids is null or id = any(p_message_ids)
    returning media_path
  )
  select coalesce(array_agg(media_path) filter (where media_path is not null), array[]::text[])
  into v_paths from removed;
  return v_paths;
end;
$$;

revoke all on function public.chat_admin_overview(),
  public.chat_admin_set_username(uuid, text), public.chat_admin_set_lock(boolean),
  public.chat_admin_force_logout(uuid),
  public.chat_admin_list_messages(timestamptz, integer),
  public.chat_admin_delete_messages(uuid[]) from public, anon;
grant execute on function public.chat_admin_overview(),
  public.chat_admin_set_username(uuid, text), public.chat_admin_set_lock(boolean),
  public.chat_admin_force_logout(uuid),
  public.chat_admin_list_messages(timestamptz, integer),
  public.chat_admin_delete_messages(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Server-only functions used by the chat-login Edge Function
-- ---------------------------------------------------------------------------
-- 5 failed attempts per key per 15 minutes.
create or replace function public.chat_login_allowed(p_throttle_key text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select count(*) < 5 from private.chat_login_attempts
  where throttle_key = p_throttle_key and not succeeded
    and attempted_at > now() - interval '15 minutes';
$$;

create or replace function public.chat_record_login(p_throttle_key text, p_succeeded boolean)
returns void language sql security definer set search_path = ''
as $$
  insert into private.chat_login_attempts (throttle_key, succeeded) values (p_throttle_key, p_succeeded);
  delete from private.chat_login_attempts where attempted_at < now() - interval '1 day';
$$;

create or replace function public.chat_resolve_login(p_username text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', m.user_id, 'email', u.email, 'role', m.role,
    'locked', (select locked from private.chat_settings where id)
  )
  from private.chat_members m join auth.users u on u.id = m.user_id
  where lower(m.username) = lower(trim(p_username));
$$;

revoke all on function public.chat_login_allowed(text),
  public.chat_record_login(text, boolean), public.chat_resolve_login(text)
  from public, anon, authenticated;
grant execute on function public.chat_login_allowed(text),
  public.chat_record_login(text, boolean), public.chat_resolve_login(text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Private storage for encrypted voice notes / audio files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 26214400, array['application/octet-stream'])
on conflict (id) do nothing;

create policy chat_media_select_members on storage.objects
for select to authenticated using (
  bucket_id = 'chat-media' and (select private.is_chat_member())
);
create policy chat_media_insert_own_folder on storage.objects
for insert to authenticated with check (
  bucket_id = 'chat-media'
  and (select private.is_chat_member())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy chat_media_delete_own on storage.objects
for delete to authenticated using (
  bucket_id = 'chat-media'
  and (select private.is_chat_member())
  and owner_id = (select auth.uid())::text
);

-- ---------------------------------------------------------------------------
-- Realtime channel authorization: typing indicators, presence and WebRTC
-- call signalling on the private "chat-room" channel.
-- ---------------------------------------------------------------------------
create policy chat_room_receive on realtime.messages
for select to authenticated using (
  (select realtime.topic()) = 'chat-room'
  and extension in ('broadcast', 'presence')
  and (select private.is_chat_member())
);
create policy chat_room_send on realtime.messages
for insert to authenticated with check (
  (select realtime.topic()) = 'chat-room'
  and extension in ('broadcast', 'presence')
  and (select private.is_chat_member())
);
