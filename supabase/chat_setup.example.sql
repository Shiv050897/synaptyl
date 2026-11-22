-- One-time setup for the private chat accounts. NOT a migration: run it by hand
-- in the SYNAPTYL project's SQL editor after the chat migration is applied.
--
-- Step 1 (Supabase dashboard -> Authentication -> Users -> Add user):
--   Create three users with "Auto Confirm User" ticked. Use email addresses
--   nobody can guess (people only ever log in with the usernames below), and
--   strong passwords of 12+ characters.
--
-- Step 2: replace the three emails below and run this file.

begin;

insert into private.chat_members (user_id, role, username)
select u.id, v.role, v.username
from (values
  ('REPLACE-x1-email@example.com',    'x1',    'X1'),
  ('REPLACE-x2-email@example.com',    'x2',    'X2'),
  ('REPLACE-admin-email@example.com', 'admin', 'Admin')
) as v(email, role, username)
join auth.users u on lower(u.email) = lower(v.email);

-- The learning site creates a student profile for every new account; chat
-- accounts are not students, so remove theirs.
delete from public.profiles p
using private.chat_members m
where p.id = m.user_id and m.role in ('x1', 'x2');

-- Must report 3; if not, an email above did not match and nothing is saved.
do $$
begin
  if (select count(*) from private.chat_members) <> 3 then
    raise exception 'Expected 3 chat members — check the emails.';
  end if;
end $$;

commit;
