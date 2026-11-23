-- Push notifications for the private chat.

-- Server-only settings (e.g. the Web Push signing key). Never exposed to browsers.
create table if not exists private.app_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table private.app_secrets enable row level security;
revoke all on private.app_secrets from public, anon, authenticated;
grant select on private.app_secrets to service_role;

-- Each signed-in device's push address. Users manage only their own rows.
create table public.chat_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  constraint chat_push_subscriptions_sizes check (
    length(endpoint) <= 1024 and length(p256dh) <= 256 and length(auth) <= 128
    and endpoint like 'https://%'
  )
);
create index chat_push_subscriptions_user_idx on public.chat_push_subscriptions (user_id);

alter table public.chat_push_subscriptions enable row level security;
create policy chat_push_select_own on public.chat_push_subscriptions
for select to authenticated using (user_id = (select auth.uid()) and (select private.is_chat_member()));
create policy chat_push_insert_own on public.chat_push_subscriptions
for insert to authenticated with check (user_id = (select auth.uid()) and (select private.is_chat_member()));
create policy chat_push_update_own on public.chat_push_subscriptions
for update to authenticated
using (user_id = (select auth.uid()) and (select private.is_chat_member()))
with check (user_id = (select auth.uid()));
-- Deleting your own device is allowed even when the chat is locked (e.g. on sign-out).
create policy chat_push_delete_own on public.chat_push_subscriptions
for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.chat_push_subscriptions to authenticated;

-- A device registered by one account and then signed in by the other moves
-- to the new account (endpoint is unique per device/browser).
create or replace function public.chat_register_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_chat_member() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.chat_push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;
revoke all on function public.chat_register_push(text, text, text) from public, anon;
grant execute on function public.chat_register_push(text, text, text) to authenticated;

-- Web Push signing key for the chat-push function (service role only).
create or replace function public.chat_push_config()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_object_agg(name, value) from private.app_secrets
  where name in ('vapid_public_key', 'vapid_private_key', 'vapid_subject');
$$;
revoke all on function public.chat_push_config() from public, anon, authenticated;
grant execute on function public.chat_push_config() to service_role;
