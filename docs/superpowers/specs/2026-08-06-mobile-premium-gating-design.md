# Porting premium content gating to the mobile app

**Date:** 2026-08-06
**Status:** Approved design, not yet implemented
**Repos touched:** `chaptr-web-main` (this one), `~/Desktop/Chaptr` (React Native), shared Supabase project

---

## 1. Problem

The mobile app has no premium content gating. The web app does. Paid reading
groups exist in production, so the mobile app currently shows `is_premium`
channels to every group member regardless of subscription.

Adding the gate to iOS raises an App Store approval question, because gating
creates a purchase surface and Guideline 3.1.1 requires in-app purchases for
digital content unlocked inside an app. The current build is approved precisely
because it has no paid content.

## 2. Decisions

Three product decisions, made 2026-08-06, that shape everything below:

| Decision | Choice | Consequence |
|---|---|---|
| How iOS users get access | **Recognize only — sell nothing on iOS** | No StoreKit, no external link, no price anywhere in the binary |
| What non-subscribers see | **Premium channels hidden entirely** | Matches existing web behaviour; no paywall UI for a reviewer to question |
| Creator monetization on iOS | **Web-only, unmentioned on iOS** | No paid toggle, no Connect onboarding, no payout view in the app |

Rejected, with reasons:

- **StoreKit IAP** — Apple takes 15–30% on top of the existing 15% platform fee,
  and creators are paid 85% via Connect. The payout arithmetic has no good answer
  at a $5/month price point.
- **US external purchase link** (permitted commission-free since the April 2025
  Epic v. Apple injunction) — the carve-out is US-storefront only. Elsewhere it
  still requires the External Purchase Link Entitlement, commission and
  disclosure sheets. Showing the link globally would violate the rules outside
  the US, so it needs storefront-conditional rendering: new logic, new failure
  modes, and a fresh surface for review to evaluate. Deferred; it is purely
  additive and invalidates nothing here.
- **Blurred previews** (`components/paywall-gate.tsx`) — a blur plus lock icon is
  literally paywall UI. It invites the one question we do not want asked. Hidden
  protects the same content with less surface area.

## 3. Scope

### Already done, do not port

**Chapter gating exists in mobile already.** The comment at
`app/(app)/groups/[groupId]/chat/[channelId]/page.tsx:84` records that the
`Math.max((currentChapter ?? 1) - 1, 0)` rule was ported *from* `GroupChatScreen.tsx`.
Web copied mobile, not the reverse. Chapter gating is also Apple-irrelevant — it
is a free spoiler-protection feature with no purchase involved.

### The actual change

Make `is_premium` channels invisible to users without an entitlement.

**Entitlement predicate** — group owner **OR** `admin` **OR** `moderator` **OR**
active `group_subscribers` row.

Web currently checks `admin` only (`chat/[channelId]/page.tsx:57`). Moderators are
included here going forward. No moderator rows exist yet, so this changes nothing
today; it means the gate is already correct when that system is built rather than
being a latent bug.

## 4. Architecture

### 4.1 The gate must move into the database

Today the paywall lives entirely in a Next.js Server Component
(`chat/[channelId]/page.tsx:59`). RLS does not implement it at all:

```sql
-- channel_messages SELECT policy, schema line 878 — membership only
exists (select 1 from group_channels gc
        join group_memberships gm on gm.group_id = gc.group_id
        where gc.id = channel_messages.channel_id
          and gm.user_id = auth.uid())
```

React Native has no trusted server. It queries Supabase directly with the anon
key and the user's JWT, so any group member could read every premium message with
one REST call. A UI-only port would be security theatre.

This is **already exploitable on web** — the browser client shares that anon key,
so devtools reaches the same endpoint. Moving the gate into RLS fixes both apps.

### 4.2 Policies must be RESTRICTIVE

Permissive policies **OR** together. A permissive "subscribers can view" policy
added alongside the existing "members can view" policy would change nothing. This
is the same trap that previously disabled the discussions/comments chapter gate.

Every policy below is `AS RESTRICTIVE`, ANDing with the existing permissive
membership policies rather than widening them.

### 4.3 Helper functions

`SECURITY DEFINER` so policy bodies do not re-trigger RLS on `group_subscribers`
or `reading_groups`, and to avoid recursion between the channel and message
policies.

```sql
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
```

`auth.uid()` works inside `SECURITY DEFINER` — it reads the request JWT claim,
not the executing role. When it is null (anonymous) every branch is false, so
anonymous users get no premium access.

Execute is revoked from `public` and granted to `authenticated` only.

### 4.4 Policies

```sql
-- group_channels: premium channels vanish from the list
create policy "premium_channels_require_entitlement"
  on public.group_channels as restrictive for select to authenticated
  using (not is_premium or public.has_group_premium_access(group_id));

-- channel_messages: cannot read, cannot post
create policy "premium_messages_require_entitlement"
  on public.channel_messages as restrictive for select to authenticated
  using (public.can_read_channel(channel_id));

create policy "premium_message_writes_require_entitlement"
  on public.channel_messages as restrictive for insert to authenticated
  with check (public.can_read_channel(channel_id));

-- channel_message_reactions: follows the message
create policy "premium_reactions_require_entitlement"
  on public.channel_message_reactions as restrictive for select to authenticated
  using (public.can_read_message(message_id));

create policy "premium_reaction_writes_require_entitlement"
  on public.channel_message_reactions as restrictive for insert to authenticated
  with check (public.can_read_message(message_id));
```

**UPDATE and DELETE on `channel_messages` are deliberately left ungated.** A user
whose subscription lapses can still edit or delete their own past messages.
Removing your own content should not require an active subscription.

Service-role writes (the Stripe webhook) bypass RLS entirely and are unaffected.

### 4.5 Consequence for the client

Once RLS is correct, premium channels simply do not return from the channel query
for a non-entitled user. **The "hidden entirely" behaviour falls out of the
database**, and needs close to zero React Native rendering work. The RN change is
mostly verifying that no screen assumes a fixed channel list or fails on an empty
one.

### 4.6 Web changes

- `chat/[channelId]/page.tsx:57` — add `moderator` to the access check.
- Extract the predicate into a single `hasGroupPremiumAccess(groupId)` helper in
  `lib/queries.ts`, alongside the existing `isSubscribedToGroup`, so owner/admin/
  moderator/subscriber is expressed once instead of being re-inlined per call site.
  Audit all `isSubscribedToGroup` call sites and route the premium-access ones
  through it.
- Existing server-side checks and the channel-list filter at `page.tsx:71` stay.
  They are now redundant with RLS, and kept as defence in depth.

## 5. iOS surface scrub

This is the load-bearing compliance work. "No purchase surface anywhere in the
binary" is the entire approval argument, so it is verified against the built app,
not just intended.

The RN source has not been read yet — the first implementation task is an audit
of `~/Desktop/Chaptr/src`. Checklist:

- [ ] No price string rendered anywhere
- [ ] No "Paid" / "Free" badge on group cards (web has one at `components/group-card.tsx:58`)
- [ ] No paid-subscription toggle in group creation (web has one at `groups-client.tsx:463`)
- [ ] No monetization section in group management
- [ ] No Stripe Connect onboarding or payout UI
- [ ] No subscribe CTA, button, or upsell copy
- [ ] No link, deep link, or in-app browser hand-off to the web subscribe or manage pages
- [ ] No "manage subscription" link for existing subscribers — status text only, or omit
- [ ] App Store description and screenshots make no reference to subscribing on the web

## 6. Migration risk

**The RLS migration changes behaviour for the already-shipped iOS build the
moment it lands, with no app update.** Mobile users currently see premium
channels; after the migration those channels disappear from the live app.

That is the intended fix, but it is user-visible. Before migrating, confirm how
many live paid groups have premium channels with active mobile members. If the
answer is zero the migration is invisible and can ship immediately. If not, it
needs sequencing with creator communication.

Also verify: per the project notes the `supabase_realtime` publication was empty
until 2026-08-02. If `channel_messages` is now published, confirm premium messages
do not leak through a `postgres_changes` subscription, which applies RLS
separately from REST reads.

## 7. Verification

**Database** — for a single paid group with one premium and one free channel,
assert the premium channel and its messages are visible to: owner ✓, admin ✓,
moderator ✓, active subscriber ✓, lapsed subscriber ✗, plain member ✗,
non-member ✗, anonymous ✗. Assert INSERT is blocked for the same negative cases.

**Performance** — the restrictive policies invoke a function per row. `EXPLAIN
ANALYZE` a 100-message channel read and confirm the SQL functions inline rather
than executing 100 times. Confirm supporting indexes exist on
`group_subscribers (subscriber_id, group_id, status)` and
`group_memberships (group_id, user_id)`.

**Web** — `npx tsc --noEmit` unfiltered. Per project notes this is the only
working gate: `pnpm build` ignores type errors and `pnpm lint` does not run.
Manually confirm subscribe, cancel and resume still work end to end.

**Mobile** — premium channels absent before subscribing, present after, with no
app restart required beyond a normal refetch.

## 8. App Review package

With these decisions the submission adds no purchase mechanism, price, or
external link. From review's perspective it is channel-level permissions on a
free app.

- A demo account **already subscribed** to a paid group, plus one that is not, so
  the reviewer sees populated channels rather than an empty state they might read
  as broken.
- Review notes stating plainly: the app is free, every group is free to join, some
  channels are member-tier, and the app sells nothing.
- No changes to App Store Connect monetization metadata.

**Residual risk: low but not zero.** Guideline 3.1.3(b) literally reads that
content acquired elsewhere may be accessed *"provided those items are also
available as in-app purchases within the app."* Apple tolerates this pattern
widely in practice (Netflix, Kindle). The scenario where it bites is Apple
classifying Chaptr as a Patreon-alike — creator-run paid communities, the one
precedent that cuts against us.

Strongest defences, both structural: the app is free and fully functional without
any subscription, and **joining a paid group costs nothing**
(`app/join/[groupId]/actions.ts:30` — *"there is no paywall on this write"*). Only
individual channels are gated. There is no crippled state.

If it is flagged anyway, the remedy is additive and invalidates none of this: add
the commission-free US external link, or StoreKit IAP.

Note that 3.1.1(a) has moved quickly since the 2025 injunction. Re-read the live
guideline text before submitting.

## 9. Out of scope

- StoreKit / IAP integration
- External purchase links and storefront detection
- Any creator monetization UI on mobile
- **Pre-existing inconsistency, noted not fixed:** web app code checks
  `is_active` on memberships, but the existing permissive RLS policies do not, so
  a deactivated member still passes the database membership check. The new
  helper checks `is_active` for the admin/moderator branch. Reconciling the
  membership policies themselves is separate work.

## 10. Sequencing

1. Audit RN source; confirm the §5 scrub list against actual screens
2. Confirm §6 migration blast radius (live paid groups with mobile members)
3. Migration: helpers, grants, restrictive policies
4. Verify §7 database matrix and Realtime
5. Web: moderator fix, `hasGroupPremiumAccess` extraction
6. Mobile: empty-list handling, scrub any surfaces found in step 1
7. Re-dump `scripts/001_chaptr_schema.sql` (per CLAUDE.md, after any migration)
8. Assemble §8 review package and submit
