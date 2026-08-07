# Handoff — premium gating (updated 2026-08-07)

## Open tasks

None on the web side. The previous open task (cancellation ejecting the member
from the group) is fixed — see below. Remaining work is in the RN repo and is
listed under "Known, documented, not fixed".

## Done this session

### 1. Cancelling a subscription no longer ejects the member (`a128e0d`)

`customer.subscription.deleted` in `app/api/webhooks/stripe/route.ts` was
writing `group_memberships.is_active = false` — the "left the group" flag that
`leaveGroup` writes and the join action flips back on. Every group is free to
join; only channels are paid, so a member who joined free, subscribed, then
cancelled was thrown out of a group they were always entitled to be in, losing
the free channels too.

The handler now only sets `group_subscribers.status = 'canceled'`. RLS drops
premium access on the next fetch on its own. A comment marks the absence as
deliberate so it does not get "helpfully" restored.

### 2. `is_active` is now enforced in RLS (migration `membership_is_active_gate`)

`group_memberships.is_active` is the only record that someone left or was
kicked — there is no row deletion. But the membership policies predated the
flag and matched on `user_id` alone, so **a kicked member kept full read and
write access to every channel**; `kickMember` was cosmetic.

Nine permissive policies on `group_channels`, `channel_messages` and
`channel_message_reactions` now require `and gm.is_active`. These were
permissive policies made *stricter*, which can only remove access — the
KNOWN TRAPS #1 danger is adding a permissive policy, not tightening one.

Two policies deliberately still key on ownership alone, not membership:
`Users can update their own messages` and `Users can remove their own
reactions`.

Verified: all 12 production membership rows are `is_active = true`, no NULLs,
so nobody lost access. Test harness includes a positive control proving an
active member can still post.

### 3. The "ungated UPDATE" item was wrong — it is already gated

The previous handoff listed "UPDATE on `channel_messages` is ungated, so a
message can be relocated into a premium channel" as an open hole. **It is
not.** Probed against production: an unentitled member attempting to move a
message they own into a premium channel gets
`42501: new row violates row-level security policy`, while the group owner
performing the identical UPDATE succeeds.

The enforcement is *emergent*, not declared: on UPDATE, Postgres checks the new
row against the restrictive SELECT policy `can_read_channel(channel_id)`. There
is no restrictive UPDATE policy. If you ever rewrite
`premium_messages_require_entitlement`, re-test relocation or add an explicit
restrictive UPDATE policy. This is documented at the policy in
`scripts/001_chaptr_schema.sql`.

## Verification

`scripts/test-premium-rls.sql` — now **14/14 PASS**, up from 10. New cases:

- kicked member sees neither free channel nor free message
- kicked member cannot post to a free channel
- member cannot relocate an owned message into a premium channel
- *positive control:* active member can still post to a free channel

Still wrapped in `begin`/`rollback`, still safe to run against production. Paste
the whole file into the Supabase MCP `execute_sql`; there is no `psql` locally.

## What is already done and must not be undone

The premium paywall lives in Postgres RLS, not UI code. On project
`ayaihmsohyniodvxfjqx` (production):

- 3 `SECURITY DEFINER STABLE` functions, `search_path = public, pg_temp`:
  `has_group_premium_access`, `can_read_channel`, `can_read_message`
- 5 policies on `group_channels`, `channel_messages`,
  `channel_message_reactions`

**Those five policies MUST stay `AS RESTRICTIVE`.** Permissive policies OR
together — rewriting any one as permissive silently disables the entire
paywall. See KNOWN TRAPS #1 in `scripts/001_chaptr_schema.sql`. Verify with:

```sql
select polname, polpermissive from pg_policy where polname like 'premium_%';
-- polpermissive must be false for all five
```

Access is granted to: group owner (`created_by`), `admin`/`moderator` members
**with an active membership**, and subscribers whose status is `active`,
`trialing`, or `past_due`. The `past_due` grace is deliberate — a failed card
keeps access while Stripe dunning retries for ~2 weeks. `unpaid` and `canceled`
end it.

`lib/queries.ts:70` `hasGroupPremiumAccess()` mirrors that function for
rendering decisions. **If you change one, change the other.** The strict
`isSubscribedToGroup()` is still used for billing UI, where only `active`
counts.

## Rules that carry over

- **All SQL goes through the Supabase MCP**, `project_id ayaihmsohyniodvxfjqx`.
  There is no `psql` and no `DATABASE_URL` on this machine.
- The MCP connects as the `postgres` superuser, which has `rolbypassrls`. Any
  query asking "what can this user see" **must** `set local role authenticated`
  and `set local request.jwt.claims` first, or the answer is meaningless.
- A blocked write *raises* rather than returning zero rows. Probe writes inside
  a subtransaction (`begin ... exception when others`) and record "did it
  land", not "did it error" — and capture `sqlerrm`, or you cannot tell a
  working gate from an unrelated failure.
- `scripts/001_chaptr_schema.sql` is a reference mirror of the live database.
  **Documentation, not a provisioning script. Never run it.** Re-dump after
  migrations.
- **Never** put the `service_role` key in the mobile app — it bypasses RLS and
  undoes the paywall. The RN app correctly uses the anon key.
- In the RN repo (`~/Desktop/Chaptr`, branch `premium-gating`): **never
  `git add -A`.** Five pre-existing modified files are unrelated to this work
  and must stay uncommitted.
- `pnpm build` ignores type errors and `pnpm lint` does not run. The only real
  gate is unfiltered `npx tsc --noEmit`.

## App Store status

No resubmission needed — the gate is server-side and the approved binary is
unaffected. The compliance argument rests on the iOS build containing no
purchase surface at all: no price, no subscribe button, no external link.
Premium channels are hidden entirely rather than shown locked.
`src/types/channels.types.ts` deliberately omits `is_premium` to keep it that
way. Do not add a lock icon, a price, or an upgrade prompt to the mobile app.

## Known, documented, not fixed

All remaining items are in the RN repo except the last two.

- Chapter-gate drift: `GroupChatScreen.tsx` lines 187/196 fetch at the raw
  chapter while `MessageList.tsx:66` filters at `chapter - 1`, so one chapter of
  spoilers reaches the device.
- `MessageList.tsx:66` treats a null `chapter_number` as 0 (always visible); web
  excludes nulls.
- `signOut` (`src/contexts/AuthContext.tsx:388`) never clears the React Query
  cache or the persisted `CHAPTR_QUERY_CACHE`. On a shared device the next user
  can briefly see the previous user's cached progress, notifications and
  discussions. **Does not affect premium content** — channels and messages live
  in `useState` and never touch disk.
- `anon` and `service_role` still hold EXECUTE on the three helper functions —
  an existence oracle over RPC, but no entitlement leak (`auth.uid()` is NULL
  for anon).

## Branches

- Web `premium-gating`, off `main` @ `d1aa843`. Clean, **not merged** — merging
  to `main` auto-deploys.
- RN `premium-gating`, off `master`. One commit, `b17f6ca` (a comment).
