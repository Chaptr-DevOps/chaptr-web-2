# Public group preview

**Date:** 2026-08-04
**Status:** Approved, ready for implementation plan

## Problem

`/join/[groupId]` is the link creators put in their bio. Today it redirects
anonymous visitors to `/signin`, so a stranger who clicks a creator's link is
asked to make an account before seeing anything about the group.

That inverts the funnel this product depends on. The intended flow is: a creator
sets up a group, drops the link in their bio, a follower clicks it, decides the
group looks worth joining, and *then* signs up. Requiring the account first
means the decision is asked for before any information is given.

## Goals

- An anonymous visitor can preview a public group: name, banner, description,
  current book, member count, and what channels exist.
- Pressing **Join** sends a signed-out visitor to signup and returns them to the
  group afterwards.
- The link unfurls with the group's identity when pasted into social bios.

## Non-goals

- Previewing private (`is_public = false`) groups. See "Access model".
- Any change to who can *read group content* — channels and messages stay
  members-only.
- An "unlisted" group state. Discussed and deferred; see "Deferred".

## Access model

**Public groups only.** A logged-out visitor previews a group when
`is_public = true`; otherwise they are sent to sign in.

This needs no RLS changes — the existing policies already allow exactly this:

| Table | Anonymous read | Policy |
|---|---|---|
| `reading_groups` | yes, when `is_public` | "Anyone can view public groups" |
| `group_memberships` | yes, when the group is public | "Users can view public group memberships" |
| `users` | yes, active profiles | "Public user profiles are viewable by everyone" |
| `books` | yes | "Books are publicly readable" |
| `group_channels` | **no** — members only | service-role read, see below |

Private groups are private on purpose: a friends-only club, a full cohort, a
group still being set up. In each case the owner does not want an anonymous
preview, so gating on `is_public` gives the right behaviour without a special
case. A creator promoting a link publicly wants a public group by definition.

**Not-found handling.** For an anonymous visitor, a group that returns no row is
either private or nonexistent, and the two are indistinguishable without a
service-role read. Send them to `/signin?redirect=/join/<id>` rather than
`/groups`: a member of a private group then signs in and lands where they meant
to go, and a nonexistent id costs one redirect.

## What each visitor sees

| Data | Anonymous | Signed in |
|---|---|---|
| Group, banner, description, book | yes (session client, RLS) | yes |
| Member **count** | yes (`head: true` count) | yes |
| Member names and avatars | **no — not fetched** | yes |
| Channel list (names, premium/gated flags) | yes (service-role) | yes |
| Channel contents / messages | no | members only |

Member identities are withheld from anonymous visitors even though RLS would
permit them. Members joined a reading group; they did not agree to appear on a
public web page that search engines can index. A count carries the social proof
without publishing who those people are.

Channel *names* do become publicly visible via the existing service-role read.
This is already true of the public `/groups/[groupId]/subscribe` page, so the
exposure is not new, but it is a deliberate choice: channel names are part of
the pitch ("what's inside"), contents remain gated.

## The Join button

Membership is free for every group. `is_paid` means "this group has a premium
tier", not "this group costs money" — `app/join/[groupId]/actions.ts` documents
this, and the data agrees: the one paid group has 2 free channels and 1 premium.
Every new group is created with two free channels.

So the primary call to action is **Join**, identically for free and paid groups:

| State | Action |
|---|---|
| Signed out | `/signup?redirect=/join/<id>` |
| Signed in, not a member | `joinGroupAction` |
| Signed in, already a member | redirect to the group (existing behaviour) |

The signup path relies on the pending-redirect mechanism added earlier today
(`lib/pending-redirect.ts`), which carries the destination through signup and
all six onboarding steps.

The premium tier is presented as **information, not a gate**: locked channels
appear in the "what's inside" list with a premium marker, and a badge shows the
price. Subscribing happens after joining, from inside the group. Putting a price
wall in front of a group anyone can join free would reintroduce the friction
this change exists to remove.

## Link unfurl metadata

`/join/[groupId]` has no `generateMetadata`, so a link pasted into a bio or a
social post renders as a bare URL. Add Open Graph tags — group name,
description, banner image — mirroring what
`app/groups/[groupId]/subscribe/page.tsx` already does.

For a feature whose whole purpose is a link in a creator's bio, the unfurl is
the first impression and is load-bearing.

Metadata must apply the same access rules as the page: a private or missing
group gets generic fallback metadata, never a leaked name.

## Paid-at-creation fix

Separate defect, in scope by request.

The create-group modal has a paid toggle (`groups-client.tsx:465`) and
`createGroup` writes `is_paid: true` with a price — but never creates a Stripe
price, because that requires a completed Connect account the creator almost
certainly does not have at creation time. `startSubscribeCheckout`
(`app/(app)/groups/actions.ts:426`) requires `stripe_price_id` and fails without
it. The result is a group that presents as paid and cannot take payment.

**Fix: establish the invariant `is_paid = true` implies `stripe_price_id IS NOT
NULL`, and let only `setGroupPaid` set it.**

- `createGroup` always creates the group with `is_paid: false`, `price: null`,
  and ignores the `isPaid`/`price` arguments for those columns.
- `createGroup` returns whether the creator asked for a premium tier, and the
  modal routes them to `/groups/<id>/manage` instead of `/groups/<id>` when they
  did, so the intent is carried to the one flow that can complete it.
- The modal's price input is removed. The toggle stays as a statement of intent
  ("I want to charge for premium channels"), with copy saying the price is set
  during Stripe setup — because it cannot be set before Connect onboarding.

No data repair is needed: the only paid group in the database has a valid
`stripe_price_id`.

## Files

| File | Change |
|---|---|
| `lib/supabase/proxy.ts` | add `/join/<uuid>` to public routes |
| `app/join/[groupId]/page.tsx` | drop auth redirect; split queries by session; add `generateMetadata` |
| `app/join/[groupId]/preview-client.tsx` | `isSignedIn` prop; CTA routing; hide member strip when anonymous |
| `app/(app)/groups/actions.ts` | `createGroup` no longer sets `is_paid`/`price` |
| `app/(app)/groups/groups-client.tsx` | creation toggle becomes intent; redirect to monetization |

## Testing

Against a real public group id (`9ec644ed-b916-497e-b9d9-6a6b9f7a579d`,
"Between the Lines", 2 free channels) and the paid one
(`7f7addfc-38c2-4260-80e0-cec49e9f8798`, "Fantasy Fiction Group", $9.99,
2 free + 1 premium):

1. Anonymous `GET /join/<public-id>` returns 200 and contains the group name,
   book, and channel names.
2. The same response contains **no member names**. "Between the Lines" has 3
   active members — `Reviewer`, `PoemReader`, `JalireCan` — so the assertion is
   that none of those strings appear in the anonymous HTML, while the count 3
   does. (Confirmed non-vacuous: both test groups have 3 members.)
3. Anonymous `GET /join/<nonexistent-uuid>` redirects to
   `/signin?redirect=…`.
4. Anonymous `GET /join/<malformed>` redirects to `/groups` (existing guard).
5. OG tags present for the public group; generic fallback for a missing one.
6. The paid group's preview shows the premium channel as locked and the price,
   with **Join** as the primary action — not a subscribe wall.
7. `createGroup` with the paid toggle on produces `is_paid = false` and
   `stripe_price_id IS NULL`; the group is never in the broken state.
8. Signed-in behaviour unchanged: member strip renders, Join joins.

The signed-out cases are reachable with `curl`; the signed-in cases need a real
session and are checked manually.

## Risks

- **Channel names become public.** Accepted, consistent with the subscribe page.
  If a creator names a channel something sensitive it is now visible; worth a
  note in the manage UI eventually.
- **Public pages are crawlable.** Group names and descriptions will be indexed.
  This is the intent for a discovery surface, but it is a change in posture and
  cannot be quietly undone once indexed.
- **Anonymous traffic hits the database.** `/join` becomes unauthenticated, so a
  scraper can enumerate public groups. Ids are uuids so enumeration is
  impractical, but the route is no longer behind auth.

## Deferred

- **Unlisted groups.** `is_public` currently controls both discoverability and
  read access. "Not in Discover, but previewable by link" is a plausible creator
  want and is impossible today. The fix is a separate `is_discoverable` column
  rather than overloading `is_public`. Not needed now — zero private groups
  exist.
- **Private-group links.** If ever wanted, the unused `reading_groups.invite_code`
  column is the right mechanism: the link carries a secret that acts as the
  credential, rather than the group id alone granting access.
