-- Phase 3: keep every published public key (so old messages stay decryptable
-- after a user moves to a new device) and allow an optional passphrase-
-- protected backup of each private key. The server never sees a passphrase or
-- an unencrypted private key.

-- Public keys become an append-only history keyed by (user, version).
alter table public.chat_keys drop constraint chat_keys_pkey;
alter table public.chat_keys add primary key (user_id, key_version);

drop policy if exists chat_keys_update_own on public.chat_keys;
revoke update on public.chat_keys from authenticated;

-- Next version number for the current user (outside RLS to avoid a policy
-- that reads its own table).
create or replace function private.chat_next_key_version()
returns integer language sql stable security definer set search_path = ''
as $$
  select coalesce(max(k.key_version), 0) + 1
  from public.chat_keys k where k.user_id = (select auth.uid());
$$;
revoke all on function private.chat_next_key_version() from public, anon;
grant execute on function private.chat_next_key_version() to authenticated;

drop policy if exists chat_keys_insert_own on public.chat_keys;
create policy chat_keys_insert_own on public.chat_keys
for insert to authenticated with check (
  user_id = (select auth.uid())
  and (select private.is_chat_member())
  and key_version = (select private.chat_next_key_version())
);

-- Encrypted private-key backups (AES-GCM with a PBKDF2-derived key).
create table public.chat_key_backups (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  key_version integer not null,
  wrapped_key text not null,
  salt text not null,
  iv text not null,
  iterations integer not null check (iterations >= 100000),
  created_at timestamptz not null default now(),
  primary key (user_id, key_version),
  foreign key (user_id, key_version) references public.chat_keys (user_id, key_version) on delete cascade,
  constraint chat_key_backups_sizes check (
    length(wrapped_key) <= 4096 and length(salt) <= 64 and length(iv) <= 64
  )
);

alter table public.chat_key_backups enable row level security;
create policy chat_key_backups_select_own on public.chat_key_backups
for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_chat_member()));
create policy chat_key_backups_insert_own on public.chat_key_backups
for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_chat_member()));
create policy chat_key_backups_delete_own on public.chat_key_backups
for delete to authenticated
using (user_id = (select auth.uid()) and (select private.is_chat_member()));
grant select, insert, delete on public.chat_key_backups to authenticated;
