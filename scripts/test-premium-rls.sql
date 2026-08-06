-- Premium-channel RLS assertions.
-- Run: paste this whole file into Supabase MCP execute_sql
--      (project_id ayaihmsohyniodvxfjqx). psql is NOT installed locally.
-- Always rolls back. Safe to run against production.
--
-- public.users has NO foreign key to auth.users, so fixture users can be
-- inserted directly. auth.uid() is simulated via request.jwt.claims.

begin;

insert into public.users (id, username) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'rlstest_owner'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'rlstest_admin'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'rlstest_mod'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'rlstest_sub'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'rlstest_lapsed'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'rlstest_member'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'rlstest_stranger');

insert into public.reading_groups (id, name, created_by, is_paid, price) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'RLS Test Group',
   'aaaaaaaa-0000-0000-0000-000000000001', true, 5);

insert into public.group_memberships (group_id, user_id, role, is_active) values
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','member',    true),
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','admin',     true),
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003','moderator', true),
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000004','member',    true),
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000005','member',    true),
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000006','member',    true);
-- user ...007 is deliberately not a member

insert into public.group_channels (id, group_id, name, channel_type, is_premium, position) values
  ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','rlstest-free',   'general', false, 0),
  ('cccccccc-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','rlstest-premium','custom',  true,  1);

insert into public.channel_messages (id, channel_id, user_id, content) values
  ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001','free message'),
  ('dddddddd-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001','premium message');

insert into public.group_subscribers (group_id, subscriber_id, status) values
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000004','active'),
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000005','canceled');

create temp table rls_results (
  label text, expect boolean, got_channel boolean, got_message boolean
) on commit drop;
grant insert, select on rls_results to authenticated;

-- Each block: assume a user's identity, record what they can see.
set local role authenticated;

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
insert into rls_results values ('owner', true,
  exists(select 1 from public.group_channels   where id='cccccccc-0000-0000-0000-000000000002'),
  exists(select 1 from public.channel_messages where id='dddddddd-0000-0000-0000-000000000002'));

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
insert into rls_results values ('admin', true,
  exists(select 1 from public.group_channels   where id='cccccccc-0000-0000-0000-000000000002'),
  exists(select 1 from public.channel_messages where id='dddddddd-0000-0000-0000-000000000002'));

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}';
insert into rls_results values ('moderator', true,
  exists(select 1 from public.group_channels   where id='cccccccc-0000-0000-0000-000000000002'),
  exists(select 1 from public.channel_messages where id='dddddddd-0000-0000-0000-000000000002'));

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}';
insert into rls_results values ('active subscriber', true,
  exists(select 1 from public.group_channels   where id='cccccccc-0000-0000-0000-000000000002'),
  exists(select 1 from public.channel_messages where id='dddddddd-0000-0000-0000-000000000002'));

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000005","role":"authenticated"}';
insert into rls_results values ('lapsed subscriber', false,
  exists(select 1 from public.group_channels   where id='cccccccc-0000-0000-0000-000000000002'),
  exists(select 1 from public.channel_messages where id='dddddddd-0000-0000-0000-000000000002'));

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000006","role":"authenticated"}';
insert into rls_results values ('plain member', false,
  exists(select 1 from public.group_channels   where id='cccccccc-0000-0000-0000-000000000002'),
  exists(select 1 from public.channel_messages where id='dddddddd-0000-0000-0000-000000000002'));

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000007","role":"authenticated"}';
insert into rls_results values ('non-member', false,
  exists(select 1 from public.group_channels   where id='cccccccc-0000-0000-0000-000000000002'),
  exists(select 1 from public.channel_messages where id='dddddddd-0000-0000-0000-000000000002'));

reset role;

-- Free channels must stay visible to every member, or the gate is too wide.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000006","role":"authenticated"}';
insert into rls_results values ('plain member sees FREE channel', true,
  exists(select 1 from public.group_channels   where id='cccccccc-0000-0000-0000-000000000001'),
  exists(select 1 from public.channel_messages where id='dddddddd-0000-0000-0000-000000000001'));
reset role;

select label,
       expect as expected,
       got_channel,
       got_message,
       case when got_channel = expect and got_message = expect
            then 'PASS' else 'FAIL' end as result
from rls_results;

do $$
declare failures int;
begin
  select count(*) into failures from rls_results
   where got_channel <> expect or got_message <> expect;
  if failures > 0 then
    raise exception 'premium RLS gate: % case(s) FAILED', failures;
  end if;
  raise notice 'premium RLS gate: all cases passed';
end $$;

rollback;
