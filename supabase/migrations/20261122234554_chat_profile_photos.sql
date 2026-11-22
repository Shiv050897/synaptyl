-- Encrypted profile photos for X1 and X2.
-- The photo is an encrypted file in chat-media; this row holds the photo's
-- decryption details, themselves encrypted with the two users' shared key.
create table public.chat_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  avatar_path text,
  ciphertext text,
  iv text,
  sender_key_version integer,
  recipient_key_version integer,
  updated_at timestamptz not null default now(),
  constraint chat_profiles_sizes check (
    (ciphertext is null or length(ciphertext) <= 4096) and (iv is null or length(iv) <= 64)
  ),
  constraint chat_profiles_complete check (
    (avatar_path is null and ciphertext is null and iv is null)
    or (avatar_path is not null and ciphertext is not null and iv is not null)
  )
);
create trigger chat_profiles_touch_updated_at before update on public.chat_profiles
for each row execute function private.touch_updated_at();

alter table public.chat_profiles enable row level security;
create policy chat_profiles_select_members on public.chat_profiles
for select to authenticated using ((select private.is_chat_member()));
create policy chat_profiles_insert_own on public.chat_profiles
for insert to authenticated with check (
  user_id = (select auth.uid()) and (select private.is_chat_member())
  and (avatar_path is null or avatar_path like ((select auth.uid())::text || '/%'))
);
create policy chat_profiles_update_own on public.chat_profiles
for update to authenticated
using (user_id = (select auth.uid()) and (select private.is_chat_member()))
with check (
  user_id = (select auth.uid())
  and (avatar_path is null or avatar_path like ((select auth.uid())::text || '/%'))
);
grant select, insert, update on public.chat_profiles to authenticated;

alter publication supabase_realtime add table public.chat_profiles;
