# Public Group Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an anonymous visitor preview a public reading group at `/join/[groupId]` and sign up from it, so a creator's bio link sells the group instead of demanding an account.

**Architecture:** The route becomes public in middleware and the page stops requiring a session. Queries split by session state — anonymous visitors get the group, book, channel list and a member *count*, but never member identities. The Join button routes signed-out visitors to `/signup?redirect=/join/<id>`, reusing the pending-redirect mechanism already in `lib/pending-redirect.ts`. No RLS changes: existing policies already permit anonymous reads of public groups.

**Tech Stack:** Next.js 16 (App Router, RSC), Supabase (`@supabase/ssr`), Tailwind v4, TypeScript.

## Global Constraints

- **There is no test framework in this repo.** Do not invent one. The verification gate for every task is `npx tsc --noEmit --incremental false` (must exit 0) plus the stated `curl` assertions against a local dev server.
- `pnpm build` ignores type and lint errors — `tsc` is the only real gate. Never treat a successful build as verification.
- Use semantic design tokens (`bg-background`, `text-[var(--text-secondary)]`, `border-[var(--border-main)]`), never hardcoded colors.
- Server actions return `{ error: string }` on failure; never throw to the client.
- Test group ids (all `is_public = true`):
  - Free: `9ec644ed-b916-497e-b9d9-6a6b9f7a579d` — "Between the Lines", 2 free channels, 3 members (`Reviewer`, `PoemReader`, `JalireCan`)
  - Paid: `7f7addfc-38c2-4260-80e0-cec49e9f8798` — "Fantasy Fiction Group", $9.99, 2 free + 1 premium channel, 3 members
- Start the dev server with `pnpm dev` and wait with `until curl -s -o /dev/null -m 3 http://localhost:3000/signin; do sleep 2; done`. Kill it with `pkill -f "next dev"` when done. `pnpm dev` rewrites `next-env.d.ts`; run `git checkout next-env.d.ts` before committing.

---

### Task 1: Anonymous access to the join route

Middleware and page currently both require a session. Neither is observable alone, so they change together.

**Files:**
- Modify: `lib/supabase/proxy.ts` (public-route list, ~line 66)
- Modify: `app/join/[groupId]/page.tsx` (auth redirect + query split, lines 21–56)
- Modify: `app/join/[groupId]/preview-client.tsx` (new `isSignedIn` prop, member section ~line 363)

**Interfaces:**
- Consumes: `isUuid` from `@/lib/route-params` (already imported in the page).
- Produces: `GroupPreviewClient` gains a required prop `isSignedIn: boolean`. Task 2 uses this same prop for CTA routing.

- [ ] **Step 1: Make `/join/<uuid>` public in middleware**

In `lib/supabase/proxy.ts`, immediately below the existing `isPublicSubscribePage` constant, add:

```ts
// A creator's bio link lands here. It must render for someone with no account —
// that preview is the pitch. Only the preview is public; joining still needs auth.
const isPublicJoinPage = /^\/join\/[^/]+\/?$/.test(path)
```

Then add it to the `isPublic` expression:

```ts
  const isPublic =
    path === '/' ||
    isPublicSubscribePage ||
    isPublicJoinPage ||
    publicRoutes.some((p) => path === p || path.startsWith(p + '/'))
```

- [ ] **Step 2: Drop the auth wall and split queries by session**

In `app/join/[groupId]/page.tsx`, replace this block:

```ts
  const supabase = await createClient()
  const profile = await getProfile()

  // Must be signed in. The param is `redirect` — what /signin actually reads;
  // middleware normally intercepts first, so this is the fallback path.
  if (!profile) {
    redirect(`/signin?redirect=/join/${groupId}`)
  }
```

with:

```ts
  const supabase = await createClient()
  const profile = await getProfile()
```

Then replace the not-found line `if (!group) redirect('/groups')` with:

```ts
  if (!group) {
    // For an anonymous visitor a private group and a missing one are
    // indistinguishable — RLS returns nothing either way. Sign-in resolves it:
    // a member of a private group lands where they meant to, and a dead link
    // costs one redirect.
    if (!profile) redirect(`/signin?redirect=/join/${groupId}`)
    redirect('/groups')
  }
```

Then guard the membership check, which needs `profile.id`:

```ts
  if (profile) {
    const { data: existing } = await supabase
      .from('group_memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', profile.id)
      .eq('is_active', true)
      .maybeSingle()

    if (existing) redirect(`/groups/${groupId}`)
  }
```

- [ ] **Step 3: Fetch member identities only for signed-in visitors**

Replace the `memberRows` query and the `members` mapping with:

```ts
  // Members joined a reading group; they did not agree to appear on a public
  // page a search engine can index. Anonymous visitors get the count only.
  let members: PreviewMember[] = []
  if (profile) {
    const { data: memberRows } = await supabase
      .from('group_memberships')
      .select('role, user:users(id, username, display_name, avatar_url, profile_image_url)')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .limit(8)

    members = (memberRows ?? [])
      .map((row) => {
        const u = row.user as any
        if (!u) return null
        return {
          id: u.id,
          name: u.display_name ?? u.username ?? 'Reader',
          avatarUrl: u.avatar_url ?? u.profile_image_url ?? null,
          isHost: row.role === 'admin',
        }
      })
      .filter(Boolean) as PreviewMember[]
  }
```

Leave the `memberCount` query exactly as it is — the RLS policy "Users can view public group memberships" permits it anonymously for public groups.

- [ ] **Step 4: Pass `isSignedIn` to the client component**

In the same file, add the prop to the `<GroupPreviewClient .../>` call:

```tsx
      isSignedIn={Boolean(profile)}
```

- [ ] **Step 5: Accept the prop and show a count-only member section**

In `app/join/[groupId]/preview-client.tsx`, add to the destructured props and its type:

```tsx
export function GroupPreviewClient({
  group,
  book,
  channels,
  members,
  memberCount,
  weeklyMessages,
  isSignedIn,
}: {
  group: PreviewGroup
  book: PreviewBook | null
  channels: PreviewChannel[]
  members: PreviewMember[]
  memberCount: number
  weeklyMessages: number | null
  isSignedIn: boolean
}) {
```

Then replace the opening of the members section (currently `{members.length > 0 && (`) so anonymous visitors still get social proof without identities:

```tsx
              {/* Members */}
              {(members.length > 0 || memberCount > 0) && (
                <section className="rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-5">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Who&apos;s Reading ({memberCount})
                  </p>
                  {members.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">
                      {memberCount === 1
                        ? '1 reader has joined so far.'
                        : `${memberCount} readers have joined so far.`}
                    </p>
                  ) : (
                  <div className="flex flex-wrap gap-2">
```

and close the new conditional by adding `)}` immediately after the existing `</div>` that ends the chip list, before `</section>`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit --incremental false`
Expected: exits 0, no output.

- [ ] **Step 7: Verify anonymous access and privacy**

Start the dev server, then run:

```bash
G=9ec644ed-b916-497e-b9d9-6a6b9f7a579d
curl -s -o /tmp/anon.html -w 'status=%{http_code}\n' -m 25 "http://localhost:3000/join/$G"
grep -c "Between the Lines" /tmp/anon.html          # expect >= 1
for n in Reviewer PoemReader JalireCan; do
  printf '%-12s ' "$n"; grep -c "$n" /tmp/anon.html || true   # expect 0 for each
done
curl -s -o /dev/null -w 'missing -> %{http_code} %{redirect_url}\n' -m 25 \
  "http://localhost:3000/join/11111111-1111-1111-1111-111111111111"
curl -s -o /dev/null -w 'malformed -> %{http_code} %{redirect_url}\n' -m 25 \
  "http://localhost:3000/join/abc-123"
```

Expected: status=200; group name present; **each member name count is 0**; missing uuid → 307 to `/signin?redirect=…`; malformed → 307 to `/groups`.

- [ ] **Step 8: Commit**

```bash
git checkout next-env.d.ts
git add lib/supabase/proxy.ts "app/join/[groupId]/page.tsx" "app/join/[groupId]/preview-client.tsx"
git commit -m "Allow anonymous preview of public groups at /join/[groupId]"
```

---

### Task 2: Route signed-out visitors from Join to signup

**Files:**
- Modify: `app/join/[groupId]/preview-client.tsx` (`joinButton`, ~line 148)

**Interfaces:**
- Consumes: `isSignedIn: boolean` from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Branch the Join button on session state**

Replace the `joinButton` definition with:

```tsx
  // Membership is free for every group — `is_paid` marks a premium *tier*, not a
  // paid door — so Join is the primary action for paid and free groups alike.
  // A signed-out visitor goes to signup; lib/pending-redirect.ts carries this
  // destination through signup and all six onboarding steps and returns them here.
  const joinButton = !isSignedIn ? (
    <Button asChild className="w-full">
      <Link href={`/signup?redirect=${encodeURIComponent(`/join/${group.id}`)}`}>
        <LogIn className="mr-1.5 h-4 w-4" /> Join Group
      </Link>
    </Button>
  ) : (
    <Button className="w-full" onClick={handleJoinClick} disabled={isPending}>
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <LogIn className="mr-1.5 h-4 w-4" /> Join Group
        </>
      )}
    </Button>
  )
```

`Link` is already imported at line 5 of this file — no import change needed.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --incremental false`
Expected: exits 0.

- [ ] **Step 3: Verify the signed-out CTA and the paid group**

```bash
G=9ec644ed-b916-497e-b9d9-6a6b9f7a579d
P=7f7addfc-38c2-4260-80e0-cec49e9f8798
curl -s -m 25 "http://localhost:3000/join/$G" | grep -o '/signup?redirect=[^"]*' | head -2
curl -s -o /tmp/paid.html -m 25 "http://localhost:3000/join/$P"
grep -c '/signup?redirect=' /tmp/paid.html    # expect >= 1 — Join, not a paywall
grep -ci 'subscribe' /tmp/paid.html           # informational: price copy may mention it
```

Expected: the free group's HTML contains `/signup?redirect=%2Fjoin%2F9ec644ed-...`; the **paid** group also shows the signup Join link, confirming no subscribe wall replaced it.

- [ ] **Step 4: Commit**

```bash
git checkout next-env.d.ts
git add "app/join/[groupId]/preview-client.tsx"
git commit -m "Send signed-out visitors from Join to signup"
```

---

### Task 3: Open Graph metadata for the invite link

**Files:**
- Modify: `app/join/[groupId]/page.tsx` (add `generateMetadata` above the page component)

**Interfaces:**
- Consumes: `isUuid` from `@/lib/route-params`; `createClient` from `@/lib/supabase/server`.
- Produces: nothing later tasks use.

- [ ] **Step 1: Add `generateMetadata`**

Add to the imports in `app/join/[groupId]/page.tsx`:

```ts
import type { Metadata } from 'next'
```

Then insert above `export default async function GroupPreviewPage`:

```ts
/**
 * The unfurl is the first impression when a creator pastes this link into a bio,
 * so it carries the group's identity. Uses the session client deliberately: RLS
 * then gives an anonymous crawler exactly what an anonymous visitor may see, and
 * a private or missing group falls back to generic copy rather than leaking a name.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>
}): Promise<Metadata> {
  const fallback: Metadata = { title: 'Join a reading group · Chaptr' }
  const { groupId } = await params
  if (!isUuid(groupId)) return fallback

  const supabase = await createClient()
  const { data: group } = await supabase
    .from('reading_groups')
    .select('name, description, banner_image_url')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) return fallback

  const title = `Join ${group.name} · Chaptr`
  const description =
    group.description ?? `Read ${group.name} together on Chaptr.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: group.banner_image_url ? [group.banner_image_url] : undefined,
    },
    twitter: {
      card: group.banner_image_url ? 'summary_large_image' : 'summary',
      title,
      description,
      images: group.banner_image_url ? [group.banner_image_url] : undefined,
    },
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --incremental false`
Expected: exits 0.

- [ ] **Step 3: Verify tags render and do not leak**

```bash
G=9ec644ed-b916-497e-b9d9-6a6b9f7a579d
curl -s -m 25 "http://localhost:3000/join/$G" | grep -oE '<meta[^>]*(og:|twitter:)[^>]*>' | head -8
curl -s -m 25 "http://localhost:3000/join/11111111-1111-1111-1111-111111111111" \
  | grep -oE '<title>[^<]*</title>'
```

Expected: the real group emits `og:title` containing "Between the Lines" and an `og:description`; the nonexistent id emits only the generic fallback title with no group name.

- [ ] **Step 4: Commit**

```bash
git checkout next-env.d.ts
git add "app/join/[groupId]/page.tsx"
git commit -m "Add Open Graph metadata to the group invite link"
```

---

### Task 4: Stop the create-group modal producing unpayable paid groups

`createGroup` writes `is_paid: true` and a price but never creates a Stripe price, because that needs a completed Connect account. `startSubscribeCheckout` (`app/(app)/groups/actions.ts:426`) then refuses the group. Establish the invariant: **`is_paid = true` implies `stripe_price_id IS NOT NULL`, set only by `setGroupPaid`.**

**Files:**
- Modify: `app/(app)/groups/actions.ts` (`createGroup`, lines 15–65)
- Modify: `app/(app)/groups/groups-client.tsx` (creation modal, lines 97–98, 155–156, 465–490)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `createGroup(formData: { name, readingPace, isPublic, isPaid })` — the `price` parameter is removed. Success returns `{ groupId: string; wantsPremium: boolean }`; failure still returns `{ error: string }`. Because the return is a union, `wantsPremium` is only accessible after narrowing on `res.error`, which the existing caller already does. `groups-client.tsx:151` is the only caller.

- [ ] **Step 1: Never set `is_paid` at creation, and drop the unused price param**

In `app/(app)/groups/actions.ts`, change the signature (lines 15–21) to drop `price`:

```ts
export async function createGroup(formData: {
  name: string
  readingPace: string
  isPublic: boolean
  isPaid: boolean
}) {
```

Then in the `.insert({ … })`, replace the two monetization lines:

```ts
      is_paid: formData.isPaid,
      price: formData.isPaid ? formData.price : null,
```

with:

```ts
      // Monetization is never enabled here. A price requires a Stripe Price
      // object, which requires a completed Connect account the creator almost
      // certainly does not have yet — writing is_paid without stripe_price_id
      // produces a group that presents as paid and cannot take payment.
      // setGroupPaid owns this transition.
      is_paid: false,
      price: null,
```

- [ ] **Step 2: Carry the creator's intent back to the caller**

Change `createGroup`'s final return from `return { groupId: group.id }` to:

```ts
  return { groupId: group.id, wantsPremium: Boolean(formData.isPaid) }
```

- [ ] **Step 3: Route intent to the one flow that can finish it**

In `app/(app)/groups/groups-client.tsx`, replace the whole of `handleCreate` (lines 146–166) with:

```tsx
  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!cName.trim()) return
    setCreateError('')
    startTransition(async () => {
      const res = await createGroup({
        name: cName,
        readingPace: cPace,
        isPublic: cPublic,
        isPaid: cPaid,
      })
      if (res.error) {
        setCreateError(res.error)
      } else {
        closeModal()
        // A creator who asked for a premium tier lands on Manage, where Connect
        // onboarding and setGroupPaid actually enable it. Sending them to the
        // group instead would strand the intent with no path to finish it.
        router.push(
          res.wantsPremium
            ? `/groups/${res.groupId}/manage`
            : `/groups/${res.groupId}`,
        )
        router.refresh()
      }
    })
  }
```

- [ ] **Step 4: Remove the price input, keep the intent toggle**

In the same file, delete the `cPrice` state declaration (line ~98):

```tsx
  const [cPrice, setCPrice] = useState('')
```

Then replace the price `<Input>` block (the `{cPaid && ( … )}` region beginning around line 468) with helper copy, keeping the `<Switch checked={cPaid} onCheckedChange={setCPaid} />` above it untouched:

```tsx
                  {cPaid && (
                    <p className="text-sm text-[var(--text-secondary)]">
                      You&apos;ll set the price and connect payouts in the next
                      step — premium channels stay locked until then.
                    </p>
                  )}
```

Finally, delete the `setCPrice('')` line inside `closeModal` (line 124) — it is the last dangling reference, and `tsc` will fail on it otherwise.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit --incremental false`
Expected: exits 0. If it reports unused `cPrice` or a missing `price` property, finish removing those references.

- [ ] **Step 6: Verify the invariant holds in the database**

This path needs a real session, so verify by data rather than curl. After creating a group through the UI with the toggle **on**, run:

```sql
select id, name, is_paid, price, stripe_price_id
from public.reading_groups
where is_paid = true and stripe_price_id is null;
```

Expected: **zero rows**, before and after. (It is zero today — the only paid group has a valid `stripe_price_id`.)

- [ ] **Step 7: Commit**

```bash
git checkout next-env.d.ts
git add "app/(app)/groups/actions.ts" "app/(app)/groups/groups-client.tsx"
git commit -m "Stop the create-group modal producing unpayable paid groups"
```

---

## Final verification

- [ ] `npx tsc --noEmit --incremental false` exits 0
- [ ] Anonymous `/join/<public-id>` returns 200 with group name, book and channel names, and **none** of `Reviewer`, `PoemReader`, `JalireCan`
- [ ] Anonymous `/join/<paid-id>` shows Join (signup link), the premium channel marked locked, and the price — no subscribe wall
- [ ] `/join/<missing-uuid>` → `/signin?redirect=…`; `/join/abc-123` → `/groups`
- [ ] OG tags present for a real group, generic fallback for a missing one
- [ ] Signed-in flow unchanged: member chips render, Join joins, existing members redirect to the group
- [ ] `select … where is_paid and stripe_price_id is null` returns zero rows

## Open question for the user

The "Hosted by <name>" line derives from `members`, so hiding member identities from anonymous visitors also hides the **host's** name. The spec says no names for anonymous visitors, and this plan implements that. But the host is the creator publicly promoting the group — their name is arguably part of the pitch, not a privacy leak. Flag before implementing if you want the host surfaced while other members stay hidden; it is a small change to fetch just the admin row when anonymous.
