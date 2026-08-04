# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Chaptr web — a Next.js port of the Chaptr mobile app (book clubs / reading tracker). Users track reading progress, join or create "reading groups" (book clubs) with chapter-gated Discord-style chat channels, some of which are paid/subscription-gated. Bootstrapped and actively developed via [v0](https://v0.app) — every merge to `main` auto-deploys, and v0 chats push commits directly to this repo.

## Commands

```bash
pnpm dev      # start dev server (Next.js, localhost:3000)
pnpm build    # production build
pnpm start    # run production build
pnpm lint     # eslint .
```

No test suite exists in this repo currently.

`scripts/001_chaptr_schema.sql` is a **reference mirror of the live database — documentation, not a provisioning script. Do not run it.** The live Postgres schema is owned by the Chaptr mobile backend (47 public tables); the file dumps the 22 tables this web app queries, verbatim: columns, types, defaults, enums, indexes and the real RLS policies, plus a "KNOWN TRAPS" section at the bottom. Re-dump it after any migration. Schema changes go through a migration against the live project, not by editing this file.

## Environment variables

Only two are required (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
Stripe is **not yet wired up for real** — see Stripe section below.

## Architecture

### Auth & routing
- Supabase Auth with `@supabase/ssr`. Three client factories, use the right one:
  - `lib/supabase/client.ts` — browser client, for `'use client'` components.
  - `lib/supabase/server.ts` — server client for Server Components/Server Actions (always create fresh per-request, per the Fluid-compute warning in the file — never hoist to a module-level singleton).
  - `lib/supabase/proxy.ts` — used only by the root `proxy.ts` to refresh the session cookie. Note the two unrelated files both named `proxy.ts`: this one holds `updateSession` (all the auth-gate logic), the root one is the Next.js file convention that calls it.
- `proxy.ts` at the repo root is the single gate for auth redirects — this is Next 16's rename of the old `middleware.ts` convention, and the exported function must be named `proxy`. Unauthenticated users get bounced to `/signin?redirect=<destination>` for any non-public route; authenticated users get bounced away from `/`, `/signin`, `/signup` to `/home`. Public routes: `/`, `/signin`, `/signup`, `/auth/*`, `/forgot-password`, `/pricing`, `/terms`, `/privacy`, `/refunds`, `/groups/<id>/subscribe`, and everything under `/api` (which authenticates itself — the Stripe webhook verifies signatures).
- `app/(app)/layout.tsx` is a second, narrower gate: redirects to `/onboarding/username` if the profile has no username and hasn't completed onboarding. All authenticated app pages live under the `(app)` route group and render inside `AppShell` (`components/app-shell.tsx`), which provides the sidebar (desktop) / bottom nav (mobile).

### Data layer
- No ORM — direct `supabase.from(...)` calls, either in Server Components or in `'use server'` action files (e.g. `app/(app)/groups/actions.ts`, `app/(app)/groups/[groupId]/group-actions.ts`, `app/(app)/library/actions.ts`).
- `lib/queries.ts` has the three read helpers reused everywhere: `getAuthUser()`, `getProfile()`, `isSubscribedToGroup(groupId)`.
- Server actions follow a consistent shape: get user via `supabase.auth.getUser()`, return `{ error: string }` on failure, `{ success: true }` or the created row's id on success, call `revalidatePath(...)` for every affected route before returning.
- `lib/types.ts` holds hand-written TypeScript interfaces mirroring the DB tables — there is no generated `database.types.ts`. **When adding/changing columns, update this file manually** and check it against `scripts/001_chaptr_schema.sql`, which is the actual source of truth for table/column names.
- Gotcha: the membership table is `group_memberships` (with `is_active`, `last_activity`, `role` columns) — the TS interface for it in `lib/types.ts` is named `GroupMember` and is missing those fields. Don't rely on that interface being complete; check the SQL schema.

### Paid groups / paywall
- A reading group can be `is_paid`; premium content is a `group_channels` row with `is_premium`. (There is no premium-books path — `group_books` does not exist in the live DB; the group's book list is `group_book_list` and has no `is_premium` column.)
- `components/paywall-gate.tsx` (`<PaywallGate locked groupId>`) is the standard wrapper for gating any premium content — renders a blurred preview + "Subscribe to unlock" CTA linking to `/groups/[groupId]/subscribe` when locked.
- **`lib/stripe.ts` is a placeholder, not real Stripe.** Its functions return shaped mock data (`createGroupCheckoutSession`, `getConnectOnboardingStatus`, `getCreatorPayoutSummary`). `startSubscribeCheckout` in `groups/actions.ts` currently writes a `group_subscriptions` row directly instead of going through real Stripe Checkout — the real Stripe Connect implementation exists in the production backend and is expected to be wired in later. Don't build on top of the placeholder as if it were real billing without flagging that it needs replacing.

### Styling / design system
- Tailwind v4 (`@import 'tailwindcss'` in `app/globals.css`, no `tailwind.config.ts`) + shadcn (`components.json`, style `base-nova`, base color `neutral`).
- Design tokens are CSS custom properties defined once in `app/globals.css` for light (`:root`) and dark (`.dark` class, plus a `prefers-color-scheme` fallback), then re-exposed as Tailwind theme colors via `@theme inline`. Always use the semantic tokens (`bg-background`, `text-[var(--text-secondary)]`, `border-[var(--border-main)]`, `bg-primary`, etc.) rather than hardcoded colors, so components stay correct in both themes.
- Fonts: `font-sans` = Inter (body/UI), `font-serif` = Crimson Pro (headings/book titles/logo) — matches the mobile app's type system.
- `components/ui/*` are shadcn primitives; feature components live flat in `components/` (e.g. `app-shell.tsx`, `book-cover.tsx`, `group-card.tsx`, `paywall-gate.tsx`).

### Reference doc
- `docs/web-parity-spec.md` is the mobile→web parity map, regenerated 2026-07-29 from the React Native source at `~/Desktop/Chaptr` (the RN app is not in this repo). It inventories every mobile screen with a **parity status** against this repo's routes, plus the RN API surface, design tokens and user flows — §7 is the porting backlog. It deliberately does *not* restate the DB schema: `scripts/001_chaptr_schema.sql` wins on anything schema-related. Both apps share one Supabase project, so tables one app writes and the other ignores (see §2.1, §2.2) are real user-visible splits.
