# Mobile Premium Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the premium-channel paywall out of the Next.js server component and into Postgres RLS, so the React Native app enforces it too, then ship an iOS build with no purchase surface for App Store review.

**Architecture:** Three `SECURITY DEFINER` helper functions express the entitlement predicate once; `AS RESTRICTIVE` policies on `group_channels`, `channel_messages` and `channel_message_reactions` AND with the existing permissive membership policies. Premium channels then stop being returned by `select('*')` for non-entitled users, so the mobile app hides them with no client code. Web keeps its server-side checks as defence in depth.

**Tech Stack:** Postgres 15 / Supabase RLS, Supabase MCP (`apply_migration`, `execute_sql`), Next.js 16 server components, React Native (Expo) at `~/Desktop/Chaptr`.

## Global Constraints

- Entitlement predicate is **owner OR admin OR moderator OR active subscriber**, identical in database and web code.
- Every new policy must be declared `AS RESTRICTIVE`. Permissive policies OR together and would silently no-op.
- The iOS binary must contain no price, no purchase button, no subscribe CTA, and no link to the web subscribe or Connect pages.
- Web type checking is `npx tsc --noEmit` run unfiltered. `pnpm build` ignores type errors and `pnpm lint` does not run in this repo.
- `scripts/001_chaptr_schema.sql` is a **reference mirror, never executed**. Schema changes go through `apply_migration` against the live project, then the file is re-dumped.
- Subscription status lives in `group_subscribers.status = 'active'` (text, not an enum). The table is `group_subscribers`, not `group_subscriptions` — CLAUDE.md is stale on this.

## Audit results (already completed — do not redo)

The `~/Desktop/Chaptr` RN source was audited on 2026-08-06:

- `is_premium` / `isPremium`: **zero occurrences.** Mobile has no premium concept.
- `is_paid`, `price`, `stripe`, `payout`, `monetiz`: **zero occurrences.** Every "subscri" match is `unsubscribeRef` from realtime teardown.
- **The §5 iOS surface scrub in the spec is already satisfied.** There is nothing to remove.
- `getGroupChannels` (`src/lib/api/groups.ts:2418`) is `select('*')` with no premium filter, so RLS alone hides premium channels.
- `GroupChatScreen.tsx:171-174` already guards an empty channel list with a user-facing error, so hiding channels cannot crash the screen.
- Chapter gating exists at `GroupChatScreen.tsx:159` and `src/components/chat/MessageList.tsx:66`, confirming the spec's claim that web ported it from mobile.

## Findings recorded, deliberately out of scope

1. **Chapter-gate drift.** `GroupChatScreen.tsx:159` computes the decremented chapter (`Math.max((currentChapter ?? 1) - 1, 0)`) for display, but lines 187/196 pass the **raw** `progressData?.currentChapter` into `loadChannelMessages` and the realtime subscription. The client-side filter in `MessageList.tsx:66` then re-filters at the decremented value, so nothing extra renders — but one chapter of spoiler messages is fetched onto the device. Web does not have this gap.
2. **Null chapter numbers.** Mobile's `MessageList.tsx:66` treats `chapter_number ?? 0`, making unstamped messages always visible. Web deliberately excludes nulls via `.lte()`.
3. **`is_active` inconsistency.** Web code filters memberships on `is_active`, but the existing permissive RLS policies do not, so a deactivated member still passes the database membership check.
4. **All-premium groups.** If a creator marks every channel premium, a non-subscriber sees "No channels found for this group". A creator misconfiguration, not worth guarding.

None of these are Apple-relevant. File them as follow-ups.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/test-premium-rls.sql` (create) | Repeatable RLS assertion harness. Self-contained fixtures in a transaction, always rolled back. |
| Migration `premium_channel_rls` (apply via MCP) | Three helper functions, grants, five restrictive policies. |
| `lib/queries.ts` (modify) | Add `hasGroupPremiumAccess()` — single source of the predicate in web code. |
| `app/(app)/groups/[groupId]/chat/[channelId]/page.tsx:54-57` (modify) | Consume the helper instead of inlining owner/admin. |
| `scripts/001_chaptr_schema.sql` (modify) | Re-dump to mirror the new policies. |
| `~/Desktop/Chaptr/src/types/channels.types.ts` (modify) | Document why `is_premium` is absent from the type. |

---

### Task 1: RLS test harness (proves the leak exists)

**Files:**
- Create: `scripts/test-premium-rls.sql`

**Interfaces:**
- Produces: fixture UUIDs `aaaaaaaa-0000-0000-0000-00000000000{1..7}` (users), `bbbbbbbb-…0001` (group), `cccccccc-…0001` (free channel) / `cccccccc-…0002` (premium channel), `dddddddd-…0001` / `…0002` (messages). Task 2 reuses none of these directly; Task 3 re-runs this file unchanged.

- [ ] **Step 1: Write the test harness**

Create `scripts/test-premium-rls.sql`:

```sql
-- Premium-channel RLS assertions.
-- Run:  supabase MCP execute_sql, or psql -f scripts/test-premium-rls.sql
-- Always rolls back. Safe to run against any environment.
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
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','admin',     true),
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
```

- [ ] **Step 2: Run it and confirm it FAILS**

Run the file's contents through Supabase MCP `execute_sql`, or:

```bash
psql "$DATABASE_URL" -f scripts/test-premium-rls.sql
```

Expected: `ERROR: premium RLS gate: 2 case(s) FAILED`, with the result table showing `lapsed subscriber` and `plain member` as FAIL — both currently see the premium channel and its message, because no policy restricts them. `non-member` already passes (no membership row).

**If this does not fail, stop.** Either the fixtures did not insert or the harness is not assuming identities correctly. A passing test here means the test is broken, not that the gate exists.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-premium-rls.sql
git commit -m "test: add failing RLS harness for premium channel gate"
```

---

### Task 2: The migration (makes the test pass)

**Files:**
- Apply via Supabase MCP `apply_migration`, name: `premium_channel_rls`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.has_group_premium_access(uuid) returns boolean`, `public.can_read_channel(uuid) returns boolean`, `public.can_read_message(uuid) returns boolean`. Task 4's web helper mirrors the first of these.

- [ ] **Step 1: Apply the migration**

Use `mcp__plugin_supabase_supabase__apply_migration` with name `premium_channel_rls`:

```sql
-- Entitlement predicate, expressed once.
-- SECURITY DEFINER so policy bodies do not re-trigger RLS on group_subscribers
-- or reading_groups, and so the channel/message policies cannot recurse.
create or replace function public.has_group_premium_access(p_group_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    exists (select 1 from public.reading_groups g
            where g.id = p_group_id and g.created_by = auth.uid())
    or exists (select 1 from public.group_memberships m
               where m.group_id = p_group_id
                 and m.user_id = auth.uid()
                 and m.is_active
                 and m.role in ('admin'::public.group_role,
                                'moderator'::public.group_role))
    or exists (select 1 from public.group_subscribers s
               where s.group_id = p_group_id
                 and s.subscriber_id = auth.uid()
                 and s.status = 'active');
$$;

create or replace function public.can_read_channel(p_channel_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_channels gc
    where gc.id = p_channel_id
      and (not gc.is_premium or public.has_group_premium_access(gc.group_id))
  );
$$;

create or replace function public.can_read_message(p_message_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.channel_messages cm
    where cm.id = p_message_id and public.can_read_channel(cm.channel_id)
  );
$$;

revoke execute on function public.has_group_premium_access(uuid) from public;
revoke execute on function public.can_read_channel(uuid)          from public;
revoke execute on function public.can_read_message(uuid)          from public;
grant  execute on function public.has_group_premium_access(uuid) to authenticated;
grant  execute on function public.can_read_channel(uuid)          to authenticated;
grant  execute on function public.can_read_message(uuid)          to authenticated;

-- RESTRICTIVE, not permissive. Permissive policies OR together and a
-- permissive "subscribers can view" would leave the existing membership
-- policy untouched, changing nothing.
create policy "premium_channels_require_entitlement"
  on public.group_channels as restrictive for select to authenticated
  using (not is_premium or public.has_group_premium_access(group_id));

create policy "premium_messages_require_entitlement"
  on public.channel_messages as restrictive for select to authenticated
  using (public.can_read_channel(channel_id));

create policy "premium_message_writes_require_entitlement"
  on public.channel_messages as restrictive for insert to authenticated
  with check (public.can_read_channel(channel_id));

create policy "premium_reactions_require_entitlement"
  on public.channel_message_reactions as restrictive for select to authenticated
  using (public.can_read_message(message_id));

create policy "premium_reaction_writes_require_entitlement"
  on public.channel_message_reactions as restrictive for insert to authenticated
  with check (public.can_read_message(message_id));
```

UPDATE and DELETE on `channel_messages` are intentionally left ungated: a lapsed subscriber may still edit or delete their own past messages.

- [ ] **Step 2: Re-run the harness and confirm it PASSES**

```bash
psql "$DATABASE_URL" -f scripts/test-premium-rls.sql
```

Expected: `NOTICE: premium RLS gate: all cases passed`, and every row in the result table reads PASS — including `plain member sees FREE channel`, which proves the gate did not over-reach.

- [ ] **Step 3: Verify INSERT is blocked**

Run via MCP `execute_sql`. Expected output: `NOTICE: INSERT correctly blocked`.

```sql
begin;
-- The acting user must NOT be the group owner, or has_group_premium_access()
-- grants them access via the created_by branch and the test passes vacuously.
insert into public.users (id, username) values
  ('aaaaaaaa-0000-0000-0000-000000000001','rlstest_owner'),
  ('aaaaaaaa-0000-0000-0000-000000000006','rlstest_member');
insert into public.reading_groups (id, name, created_by, is_paid) values
  ('bbbbbbbb-0000-0000-0000-000000000001','RLS Test Group',
   'aaaaaaaa-0000-0000-0000-000000000001', true);
insert into public.group_memberships (group_id, user_id, role, is_active) values
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000006','member',true);
insert into public.group_channels (id, group_id, name, channel_type, is_premium, position) values
  ('cccccccc-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001',
   'rlstest-premium','custom',true,1);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000006","role":"authenticated"}';

do $$
begin
  insert into public.channel_messages (channel_id, user_id, content)
  values ('cccccccc-0000-0000-0000-000000000002',
          'aaaaaaaa-0000-0000-0000-000000000006','should be blocked');
  raise exception 'FAIL: INSERT into premium channel was NOT blocked';
exception
  when insufficient_privilege then
    raise notice 'INSERT correctly blocked';
end $$;

reset role;
rollback;
```

If this reports FAIL, the insert succeeded and non-subscribers can post into premium channels. Check that `premium_message_writes_require_entitlement` was created and is `RESTRICTIVE` — `select polname, polpermissive from pg_policy where polrelid = 'public.channel_messages'::regclass;` should show `polpermissive = false` for it.

- [ ] **Step 4: Check query plans and indexes**

The restrictive policies call a function per row. Confirm the SQL functions inline rather than executing per message:

```sql
explain analyze
select id from public.channel_messages
where channel_id = 'cccccccc-0000-0000-0000-000000000001' limit 100;
```

Then confirm supporting indexes exist:

```sql
select tablename, indexname, indexdef from pg_indexes
where schemaname='public'
  and tablename in ('group_subscribers','group_memberships','group_channels')
order by tablename, indexname;
```

Expected: an index covering `group_subscribers (subscriber_id, group_id)` (the unique constraint provides this) and `group_memberships (group_id, user_id)` (likewise). If either is missing, add it before proceeding.

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "feat(db): gate premium channels behind restrictive RLS

Entitlement is owner, admin, moderator or active subscriber. Applied as
migration premium_channel_rls; the SQL lives in the migration history,
not in scripts/, since 001 is a reference mirror."
```

---

### Task 3: Verify Realtime does not leak

**Files:** none modified — this is a verification gate.

**Interfaces:**
- Consumes: policies from Task 2.

Realtime `postgres_changes` evaluates RLS separately from REST reads. Per the project notes the `supabase_realtime` publication was empty until 2026-08-02, so its current contents must be checked rather than assumed. `src/lib/api/realtime.ts:610` subscribes to `channel_messages`.

- [ ] **Step 1: Check what is published**

```sql
select schemaname, tablename from pg_publication_tables
where pubname = 'supabase_realtime' order by tablename;
```

- [ ] **Step 2: Decide based on the result**

If `channel_messages` is **not** listed: nothing can leak through realtime. Record that and move to Task 4.

If it **is** listed: sign in to the web app as a user who is a plain member of a paid group, open devtools, and subscribe directly:

```js
const ch = supabase.channel('leak-test')
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'channel_messages' },
      p => console.log('LEAK CHECK — received:', p.new))
  .subscribe()
```

Then, as the group owner in another browser, post a message in a premium channel. Expected: **nothing logs.** If the payload arrives, the realtime path bypasses the new policies and must be fixed before shipping — the usual remedy is enabling RLS enforcement on the publication or moving those subscriptions behind an authorized channel.

- [ ] **Step 3: Commit the finding**

```bash
git commit --allow-empty -m "test: verify realtime does not bypass premium RLS"
```

---

### Task 4: Web — single entitlement helper, moderators included

**Files:**
- Modify: `lib/queries.ts`
- Modify: `app/(app)/groups/[groupId]/chat/[channelId]/page.tsx:54-57`

**Interfaces:**
- Consumes: nothing from earlier tasks (mirrors Task 2's predicate in TypeScript).
- Produces: `hasGroupPremiumAccess(groupId: string): Promise<boolean>` exported from `lib/queries.ts`.

- [ ] **Step 1: Add the helper**

Append to `lib/queries.ts`:

```ts
/**
 * True if the current user may see this group's premium channels.
 *
 * Mirrors public.has_group_premium_access() in the database — if you change
 * one, change the other. RLS is the real gate; this exists so server
 * components can decide what to render without a round trip per surface.
 */
export async function hasGroupPremiumAccess(groupId: string): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: group } = await supabase
    .from('reading_groups')
    .select('created_by')
    .eq('id', groupId)
    .maybeSingle()
  if (group?.created_by === user.id) return true

  const { data: membership } = await supabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (membership?.role === 'admin' || membership?.role === 'moderator') return true

  return isSubscribedToGroup(groupId)
}
```

- [ ] **Step 2: Use it in the chat page**

In `app/(app)/groups/[groupId]/chat/[channelId]/page.tsx`, change the import on line 3:

```ts
import { getProfile, hasGroupPremiumAccess } from '@/lib/queries'
```

Replace lines 54-57:

```ts
  // Premium gate — enforced here, not just in the group page's channel list,
  // so a premium channel can't be reached by deep-linking to its URL. RLS
  // enforces the same predicate at the database level.
  const hasPremiumAccess = await hasGroupPremiumAccess(groupId)
```

This drops the local `membership.role === 'admin'` check, which excluded moderators. The `membership` lookup above it stays — line 31 still uses it to redirect non-members.

- [ ] **Step 3: Find any other call site that needs the same predicate**

```bash
grep -rn "isSubscribedToGroup" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

For each hit, decide: gating premium *content* → switch to `hasGroupPremiumAccess`. Rendering subscribe/cancel billing UI (e.g. `app/groups/[groupId]/subscribe/`) → leave as `isSubscribedToGroup`, since an owner is not a subscriber and should not be shown a cancel button.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors. Run it unfiltered — `pnpm build` ignores type errors and `pnpm lint` does not run in this repo.

- [ ] **Step 5: Manually verify the web app still works**

With `pnpm dev`: as a group owner open a premium channel (expect access); as a plain member of a paid group open the group page (expect premium channels absent from the list) and deep-link straight to the premium channel URL (expect redirect to `/subscribe`). Confirm subscribe, cancel and resume still complete.

- [ ] **Step 6: Commit**

```bash
git add lib/queries.ts "app/(app)/groups/[groupId]/chat/[channelId]/page.tsx"
git commit -m "refactor(groups): extract hasGroupPremiumAccess, grant moderators premium"
```

---

### Task 5: Mobile — verify hiding works, document why

**Files:**
- Modify: `~/Desktop/Chaptr/src/types/channels.types.ts:8-19`

**Interfaces:**
- Consumes: policies from Task 2.

No functional RN change is required: `getGroupChannels` is `select('*')`, so premium channels simply stop arriving.

- [ ] **Step 1: Verify against the running app**

Run the RN app signed in as a plain member of a paid group that has a premium channel. Expected: the premium channel is absent from the channel list, the free channels work normally, and no error appears. Then make that same user an active subscriber:

```sql
insert into public.group_subscribers (group_id, subscriber_id, status)
values ('<group-id>', '<user-id>', 'active')
on conflict (subscriber_id, group_id) do update set status = 'active';
```

Pull to refresh. Expected: the premium channel appears.

- [ ] **Step 2: Document the deliberate omission**

`GroupChannel` in `src/types/channels.types.ts` has no `is_premium` field even though the query selects `*`. Leave it that way and record why, so nobody "fixes" it into a badge. Add above the interface at line 8:

```ts
/**
 * Note: there is deliberately no `is_premium` field here.
 *
 * Premium channels are filtered out by Postgres RLS before they reach this
 * client, so the app never receives one it may not open. Adding the field
 * would invite rendering a lock or price, and the iOS build must contain no
 * purchase surface of any kind — see
 * docs/superpowers/specs/2026-08-06-mobile-premium-gating-design.md §5.
 */
```

- [ ] **Step 3: Confirm the binary is still clean**

```bash
cd ~/Desktop/Chaptr && grep -rniE "is_premium|isPremium|is_paid|isPaid|\bprice\b|stripe|payout|monetiz|subscribe now|upgrade" src --include="*.ts" --include="*.tsx" | grep -viE "unsubscribe|subscribeTo|\.subscribe\(" 
```

Expected: no output. Any hit must be removed before submission — this grep is the compliance argument.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/Chaptr
git add src/types/channels.types.ts
git commit -m "docs(channels): explain why GroupChannel omits is_premium"
```

---

### Task 6: Re-dump the schema mirror

**Files:**
- Modify: `scripts/001_chaptr_schema.sql`

- [ ] **Step 1: Add the new policies and functions to the mirror**

Per CLAUDE.md the file is re-dumped after any migration. Add the three functions and five policies from Task 2 in the existing style, placing the policies beside the tables they guard: `group_channels` policies after line 875, `channel_messages` after line 900, `channel_message_reactions` in its own section.

- [ ] **Step 2: Update the KNOWN TRAPS section**

The file currently states at line 1253 that "premium gating exists only on `group_channels.is_premium`". Extend that entry:

```
--    it has no is_premium column — premium gating exists only on
--    group_channels.is_premium, and is enforced by the RESTRICTIVE policies
--    premium_channels_require_entitlement / premium_messages_require_entitlement.
--    Those policies MUST stay RESTRICTIVE: permissive policies OR together, so
--    a permissive rewrite would silently disable the paywall entirely.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/001_chaptr_schema.sql
git commit -m "docs(schema): re-dump mirror with premium gating policies"
```

---

### Task 7: Seed the App Review environment

**Files:** none — data only.

There are no live users, so review data has to be built. A reviewer who sees empty screens can reject under 2.1 or 4.2 regardless of anything to do with gating.

- [ ] **Step 1: Create two real accounts**

Sign up through the app (not SQL — they must be able to log in): `appreview+sub@chaptr…` and `appreview+free@chaptr…`. Record both passwords for the review notes.

- [ ] **Step 2: Build a group worth looking at**

As a third account you control, create a paid group with a real book, at least one free channel and one premium channel, and have both review accounts join it. Post enough genuine-looking message history in both channels that neither reads as broken — a dozen or so messages across a few chapters, from more than one member.

- [ ] **Step 3: Entitle the subscriber account**

```sql
insert into public.group_subscribers (group_id, subscriber_id, status)
values ('<group-id>', '<appreview+sub user id>', 'active')
on conflict (subscriber_id, group_id) do update set status = 'active';
```

- [ ] **Step 4: Verify both accounts on a real device**

Log in as `appreview+sub` — the premium channel is present and populated. Log in as `appreview+free` — the premium channel is absent, everything else works, and nothing on screen mentions price, subscribing, or a website.

- [ ] **Step 5: Commit the notes**

Record group id, both account emails and passwords in your password manager, not in the repo.

```bash
git commit --allow-empty -m "chore: seed App Review environment"
```

---

### Task 8: Submission

**Files:** none — App Store Connect.

- [ ] **Step 1: Write the review notes**

Paste into App Store Connect → App Review Information → Notes:

```
Chaptr is a free reading-group app. Creating an account, browsing groups,
joining any group, chatting and tracking reading progress are all free and
require no purchase. The app does not sell anything and contains no in-app
purchases.

Some individual chat channels within a group are set by the group's creator
as member-only. Members who do not have access simply do not see those
channels; there is no purchase prompt in the app.

Two demo accounts are provided:
  appreview+sub@…  / <password>  — has access to the member-only channel
  appreview+free@… / <password>  — does not

Both are members of the group "<group name>", reachable from the Groups tab.
```

- [ ] **Step 2: Confirm the metadata makes no purchase claims**

App Store description, screenshots, keywords and What's New must not mention subscribing, pricing, or the website. Confirm no in-app purchases are configured for the app in App Store Connect.

- [ ] **Step 3: Re-read the current guideline text**

Guideline 3.1.1(a) has changed repeatedly since the 2025 Epic injunction. Re-read the live text before submitting rather than relying on this plan.

- [ ] **Step 4: Submit**

If rejected under 3.1.3(b), the remedy is additive and invalidates nothing here: add the commission-free US external purchase link, or StoreKit IAP. See the spec's §8.

---

## Verification summary

| Gate | Command | Expected |
|---|---|---|
| RLS matrix | `psql "$DATABASE_URL" -f scripts/test-premium-rls.sql` | `all cases passed` |
| Premium INSERT blocked | Task 2 Step 3 block | `INSERT correctly blocked` |
| Realtime | `select … from pg_publication_tables` + devtools probe | no premium payload received |
| Web types | `npx tsc --noEmit` | no errors, run unfiltered |
| iOS binary clean | Task 5 Step 3 grep | no output |
| Review accounts | manual, both accounts on device | premium present / absent |
