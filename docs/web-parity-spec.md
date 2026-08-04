# Chaptr Web Parity Specification

Derived from the React Native source at `~/Desktop/Chaptr` on 2026-07-29, cross-checked against this repo's routes and the live Supabase project (`ayaihmsohyniodvxfjqx`).

**Both apps talk to the same Supabase project.** This is not two environments — it is one database with two clients. Any table one app writes and the other ignores is a real user-visible split, not drift.

**How to read this doc**

- §1 is the authoritative screen inventory *with parity status*. It is the porting backlog.
- §2 does **not** restate the schema. `scripts/001_chaptr_schema.sql` is a verbatim mirror of the live database and wins over anything written here.
- Status keys: ✅ ported · ⚠️ partial · ❌ missing · ➕ web-only (no mobile equivalent)

Regenerate this doc by re-walking `App.tsx`, `src/navigation/*`, `src/types/navigation.ts`, `src/lib/api/*` and `src/theme/*`.

---

## 1. Screen inventory

### 1.1 Auth stack — `src/navigation/AuthNavigator.tsx`

| Mobile screen | Web route | Status | Notes |
| :--- | :--- | :--- | :--- |
| `Welcome` | `/` | ✅ | |
| `SignIn` | `/signin` | ✅ | Both have Google + Apple OAuth (`src/lib/api/oauth.ts`). Mobile additionally supports **phone/OTP** sign-in (`signUpWithPhone`, `verifyPhoneOTP`, `resendPhoneOTP`) — ❌ on web |
| `SignUp` | `/signup` | ✅ | |
| `TermsOfService` | — | ❌ | Reachable pre-auth on mobile |
| `PrivacyPolicy` | — | ❌ | Reachable pre-auth on mobile |
| — | `/forgot-password` | ➕ | Mobile has `resetPassword`/`updatePassword` in `auth.ts` but no dedicated screen |

### 1.2 Onboarding

⚠️ **Mobile has two divergent onboarding stacks**, and this is a live inconsistency in the RN app, not a doc artifact:

- `OnboardingNavigator.tsx` — the one actually mounted by `App.tsx` when `!profile.onboarding_completed_at`: `OnboardingWelcome → OnboardingPromise → OnboardingCoreLoop → OnboardingGenrePreferences → OnboardingBookSelection → OnboardingChapter → OnboardingJumpIn`
- `AuthNavigator.tsx` — a second "Strava-style" flow reachable from signup: `OnboardingUsername → OnboardingBookSelection → OnboardingGenrePreferences → OnboardingReadingGoal → OnboardingJumpIn`

`App.tsx:85` carries the comment *"Onboarding screens removed - using contextual tooltips only"*, which contradicts both. Treat mobile onboarding as unsettled; don't chase exact parity here.

| Mobile screen | Web route | Status | Data writes |
| :--- | :--- | :--- | :--- |
| `OnboardingUsername` | `/onboarding/username` | ✅ | `checkUsernameAvailability` RPC, `updateUsername` |
| `OnboardingBookSelection` | `/onboarding/books` | ✅ | OpenLibrary search → `createBookFromOpenLibrary`, `getChapterCountFromGoogleBooks`, `updateBookChapters` |
| `OnboardingChapter` | `/onboarding/chapter` | ✅ | `createInitialReadingProgress` |
| `OnboardingGenrePreferences` | `/onboarding/genres` | ✅ | `users.preferred_genres` |
| `OnboardingReadingGoal` | `/onboarding/goal` | ✅ | `users` + `user_reading_goals` — **verify web writes `user_reading_goals`; it currently does not** |
| `OnboardingJumpIn` | `/onboarding/jump-in` | ✅ | `completeOnboarding` → `onboarding_completed_at` |
| `OnboardingWelcome` | — | ❌ | Narrative intro |
| `OnboardingPromise` | — | ❌ | Narrative intro |
| `OnboardingCoreLoop` | — | ❌ | Goal-selection intro (`toggleGoal`) |

Every onboarding screen calls `startScreenTimer`/`getScreenElapsedSeconds` and `updateOnboardingProgress` for funnel analytics — ❌ not ported.

### 1.3 Main tabs

| Mobile screen | Web route | Status | Notes |
| :--- | :--- | :--- | :--- |
| `Home` | `/home` | ⚠️ | Mobile adds live **presence** (`joinGroupPresence`, `leaveAllPresence`, `isUserOnline`), pace nudging (`nudgeDeadlines`, `setCompletionTargetDate`, overdue countdown), and `moveBookToShelf`. Web has the recap / set-pace / update-chapters modals |
| `Groups` | `/groups` | ⚠️ | Mobile has `searchGroupsWithFilters` + a filter modal and `getGroupRecommendations`; web's discovery is simpler |
| `Library` | `/library` | ✅ | Shelves on `user_library` + collections on `custom_shelves`/`shelf_books`, same as mobile (§2.1). Mobile still has richer per-book fields (`rating`, `review`, `priority`, `notes`) that web does not surface |
| `Profile` | `/profile` | ⚠️ | Mobile shows XP/tier/badges/achievements/milestones/personal-records/monthly-trends (`getUserXPAndLevel`, `getUserBadges`, `getUserAchievements`, `getProfileProgressMetrics`). Web shows none of it |

### 1.4 Stack screens

| Mobile screen | Params | Web route | Status |
| :--- | :--- | :--- | :--- |
| `GroupDetail` | `{ group }` | `/groups/[groupId]` | ✅ |
| `GroupChat` | `{ groupId, groupName, currentBook? }` | `/groups/[groupId]/chat/[channelId]` | ✅ reactions (§2.2) and threading (§2.6) fixed 2026-07-29 |
| `GroupSettings` | `{ groupId }` | `/groups/[groupId]/manage` | ⚠️ mobile also does banner upload (`uploadGroupBanner`/`deleteGroupBanner`) and group colors |
| `GroupMembers` | `{ groupId }` | folded into `group-tabs.tsx` | ✅ |
| `GroupPreview` | `{ groupId?, inviteCode?, source }` | `/join/[groupId]` | ✅ deep-link target on both |
| `Notifications` | — | `/notifications` | ⚠️ mobile is realtime (`NotificationContext`); web is not |
| `Settings` | — | `/settings` | ⚠️ mobile adds `exportAndDownloadUserData` (GDPR export) and `deleteAccount` |
| `EditProfile` | — | folded into `/profile` + `settings/actions.ts` | ✅ `updateProfile`, `updateAvatar`, `uploadAvatar` |
| `UserProfile` | `{ userId, username?, display_name? }` | `/profile/[userId]` | ⚠️ mobile adds follow/unfollow, block/unblock, report, activity feed |
| `AdminDashboard` | — | `/admin` | ⚠️ mobile has the full moderation queue (`getReportsForAdmin`, `getAutoHiddenContent`, `approveContent`, `removeContent`, `dismissReport`, `getModerationActions`, `getModerationStats`) |
| `DiscussionDetails` | `{ discussionId, … }` | `/home/discussions/[discussionId]` | ⚠️ mobile adds reactions, follow-from-thread, reply modal |
| `Notes` | `{ bookId, bookTitle, … }` | `/library/notes/[bookId]` | ✅ |
| `NoteEditor` | `{ bookId, editingNote? }` | folded into notes client | ⚠️ mobile supports voice dictation |
| `AddBook` | — | `/library/add` | ✅ |
| `ChapterCompletion` | `{ chapterNumber, bookId, groupId, … }` | modals under `components/currently-reading/` | ⚠️ **the biggest functional gap** — see below |
| `BookDetails` | `{ bookId, bookData? }` | — | ❌ no `/library/[bookId]` at all |
| `FinishedReaders` | `{ bookId, bookTitle, … }` | — | ❌ |
| `BlockedUsers` | — | — | ❌ `user_blocks` unused by web |
| `NotificationSettings` | — | — | ❌ `user_notification_settings` unused by web; `/settings` writes only `users`, so those toggles would not persist |
| `CommunityGuidelines` | — | — | ❌ |
| `PrivacyPolicy` | — | — | ❌ |
| `TermsOfService` | — | — | ❌ |
| `HelpSupport` | — | — | ❌ |
| `UITesting` | — | — | n/a, `__DEV__` only |
| — | `/groups/[groupId]/subscribe` | ➕ | no mobile equivalent |
| — | `/api/webhooks/stripe` | ➕ | no mobile equivalent |

**`ChapterCompletion` detail.** Mobile's completion screen writes `chapter_completions` *and* runs: swipe-to-complete, text **or audio** reflection (`uploadReflectionAudio`, `expo-speech` permissions, waveform UI, `reflection_type` enum = `text|audio|skipped`), a vocabulary step (`book_vocabulary`), XP award + confetti/celebration modals, a book-completion modal, an optional "post as discussion" step (`createChapterDiscussion`), and reading-insight generation (`getReadingInsights`). Web handles chapter advance + `reflection_text` only.

---

## 2. Data models

**`scripts/001_chaptr_schema.sql` is the source of truth** — it is a verbatim mirror of the live database (columns, types, defaults, enums, indexes, RLS policies) with a KNOWN TRAPS section. Do not duplicate column lists here; they go stale and that is exactly how the previous version of this doc misled the port.

Table surface: mobile queries 44 tables, web queries 22. Web's set is nearly a subset of mobile's.

### 2.1 Library shelves — fixed 2026-07-29 ✅

Mobile treats `user_library` (the `shelf_type` enum `tbr|reading|completed|shelved|wishlist`) as the shelf system, and `custom_shelves`/`shelf_books` as user-created collections. Web had no `user_library` at all: it derived its shelf tabs from `reading_progress.status`, so a book shelved on mobile was invisible on web.

Worse, `reading_progress.status` is the `reading_status` enum (`reading|completed|paused|abandoned`), and web's tabs were `tbr|reading|finished|dnf`. Three of the four were not legal values, so **web's TBR, Finished and DNF actions failed at the database** (22P02) — only "Reading" ever worked.

Web now reads and writes `user_library`, matching mobile:

- shelf membership → `user_library.shelf_type`; reading position → `reading_progress`, overlaid on the card by `book_id`;
- **only `tbr`, `shelved` and `completed` are real shelves.** Mobile writes nothing else (`LibraryScreen.tsx:561` only ever writes `tbr`), and its tabs are Discover · TBR · Shelved · Completed. `SHELF_OPTIONS` holds those three; do not reintroduce `finished`/`dnf`;
- **the "Reading" tab is derived from `reading_progress.status`, not a shelf** — reading is a state you are in, not a shelf you curate. `LIBRARY_TABS` adds it for display only. Web keeps this tab where mobile does not, because desktop has room for it; mobile surfaces currently-reading on Home instead. The 7 legacy `shelf_type = 'reading'` rows were migrated to `shelved`;
- `user_library` is unique on `(user_id, book_id, shelf_type)`, **not** `(user_id, book_id)`, so a book can sit on several shelves; `updateBookShelf` deletes the source row instead of updating into a conflict;
- shelving as `reading` also creates a `reading_progress` row so the book reaches Home. Other shelves deliberately create none — a TBR book you haven't started has no progress, which is precisely what the old model couldn't express;
- "remove from library" now deletes the shelf row and **keeps** reading progress and notes.

Collections (`custom_shelves`/`shelf_books`) were always shared with mobile and are unchanged — which is why the library felt half-synced rather than broken.

### 2.2 Channel reactions — fixed 2026-07-29 ✅

`message_reactions.message_id` has an FK to **`group_messages`** (the legacy group-level chat), not `channel_messages`. Mobile respects this: it uses `channel_message_reactions` for channel messages (`addChannelMessageReaction` / `removeChannelMessageReaction`) and reserves `message_reactions` for `group_messages`. Web was writing `message_reactions` from the channel chat, which could not satisfy the FK — and whose SELECT policy joins `group_messages`, so such rows would have been invisible regardless.

Web now uses `channel_message_reactions` in both the server fetch and the client. Two constraints of that table drove a behaviour change, and any future reaction UI must respect them:

- unique on **`(message_id, user_id)`** — no `reaction_type` — so a user holds at most **one** reaction per message; picking a second emoji replaces the first rather than adding to it;
- there is **no UPDATE policy**, so switching emoji is delete-then-insert.

`reaction_type` there is a plain `varchar` (arbitrary emoji are fine), unlike `message_reactions.reaction_type`, which is the `reaction_type` enum limited to `like|love|laugh|insightful`.

### 2.3 Tables mobile uses that web never touches

`user_activity_feed`, `user_badges`, `badges`, `user_achievements`, `achievements`, `user_follows`, `user_blocks`, `user_reading_goals`, `user_notification_settings`, `user_push_tokens`, `reading_progress_snapshots`, `reading_analytics_cache`, `discussion_bookmarks`, `book_vocabulary`, `moderation_actions`, `channel_message_reactions`, `group_messages`, `reviews`.

### 2.4 Tables web uses that mobile never touches

`group_subscribers`, `creator_payout_accounts`, and the paid columns on `reading_groups` (`is_paid`, `price`, `stripe_price_id`, `invite_code`) plus `group_channels.is_premium`.

### 2.5 Mobile queries five tables that do not exist

`group_invite_codes`, `group_invitations`, `user_notifications`, `reflections`, `chapters` — dead code paths in the RN app. Don't port them.

### 2.6 Channel threading — fixed 2026-07-29 ✅

The chat feature threaded replies on **`channel_messages.parent_message_id`** — a column the live table does not have. The real threading column is **`reply_to_message_id`** (FK to `channel_messages(id)`, `on delete set null`), which is what mobile uses. Every threaded reply insert failed, and the main feed never filtered replies out of the top-level list.

`page.tsx` carried a fallback query commented as working around a "missing `parent_message_id` column if migration hasn't been run yet". That migration was never going to happen — the mobile backend had already solved threading under a different name. The fallback is removed; it existed only to mask this bug, and it also swallowed unrelated query errors.

Renamed across all 12 sites: `groups/actions.ts` (the `sendMessage` action's 5th parameter and its insert), `chat/[channelId]/page.tsx` (select), and `chat-client.tsx` (message type, realtime handler, thread fetch, optimistic reply, feed filtering, reply counts).

---

## 3. API surface

Mobile has no REST layer; `src/lib/api/*` are direct Supabase client wrappers. 17 modules. Web's equivalent is `'use server'` action files plus `lib/queries.ts`.

| Module | Key exports | Web equivalent |
| :--- | :--- | :--- |
| `auth.ts` | `signUp`, `signIn`, `signOut`, `resetPassword`, `updatePassword`, `checkUsernameAvailability`, `updateUsername`, `updateOnboardingProgress`, `getUserProfile`, `updateUserProfile`, `uploadAvatar`, `searchUsers`, `signUpWithPhone`/`signInWithPhone`/`verifyPhoneOTP`/`resendPhoneOTP`, `signInWithGoogle`, `signInWithApple`, `deleteAccount` | partial — `settings/actions.ts`, `lib/queries.ts` |
| `oauth.ts` | `initializeGoogleSignIn`, `signInWithGoogle`, `signInWithApple`, `isAppleSignInAvailable` | ✅ web OAuth in `/signin` |
| `books.ts` | ~38 exports: OpenLibrary + Google Books search, `createBookFromOpenLibrary`, `startReadingBook`, `updateReadingProgress`, `completeChapter`, `uploadReflectionAudio`, `calculateAndUpdateUserVelocity`, pace helpers, `getPersonalizedRecommendations` | partial — `library/actions.ts` |
| `library.ts` | `getUserLibrary`, `addBookToLibrary`, `moveBookToShelf`, shelf CRUD, `getUserReadingStats`, progress CRUD, personal-note CRUD, `getGroupSuggestionsForBook` | partial — see §2.1 |
| `groups.ts` | ~60 exports: group CRUD, join/leave, members + roles, progress aggregation, invite codes + invitations, announcements + comments, channels, channel messages + reactions, group book list | partial — `groups/actions.ts`, `group-actions.ts`, `monetization-actions.ts` |
| `discussions.ts` | discussion + comment CRUD, reactions, bookmarks, `buildCommentTree`, `createChapterDiscussion` | partial — `home/discussions/` |
| `notifications.ts` | notification CRUD, unread count, `createNotification`, achievements (`checkAndAwardAchievements`) | partial — no achievements |
| `moderation.ts` | block/unblock, `createReport`, `filterBlockedContent`, admin queue, `COMMUNITY_GUIDELINES` | ❌ mostly missing |
| `badges.ts` | `getUserBadges`, `checkUserBadges`, `getUserXPAndLevel`, `getBadgeStats` | ❌ |
| `profiles.ts` | follow graph, `getUserActivityFeed`, `setReadingGoal`, `updatePrivacySettings` | ❌ |
| `reading-analytics.ts` | `getUserReadingPatterns`, `getBookReadingAnalytics`, `getReadingInsights`, `getCachedAnalytics` | ❌ |
| `reading-pace.ts` | `calculateDeadlines`, `setCompletionTargetDate`, `nudgeDeadlines`, `getNextChapterDeadline` | ⚠️ set-pace modal only |
| `realtime.ts` | `realtimeManager`, `presenceManager`, `isUserOnline`, `formatLastSeen` | ⚠️ chat only |
| `search.ts` | `globalSearch` across books/users/groups/discussions, `getTrendingContent`, `getSearchSuggestions` | ❌ no global search |
| `onboarding.ts` | `completeOnboarding`, `updateOnboardingScreen`, `getRecentActivityFeed`, `getActiveReaderCount` | partial |
| `storage.ts` | `pickImageFromGallery`, `uploadGroupBanner`, `deleteGroupBanner` | ❌ group banners |
| `data-export.ts` | `exportUserData`, `exportAndDownloadUserData` | ❌ GDPR export |

> **Payments.** Mobile contains **zero** Stripe/paywall/premium references — verified by grep. The paid-group layer (`is_paid`, `is_premium` channels, `group_subscribers`, `creator_payout_accounts`, Stripe Connect payouts) is **web-only**, and `lib/stripe.ts` is still a placeholder. Whatever ships on web here has no mobile counterpart and no mobile UI to reveal it.

---

## 4. Design tokens

Source of truth: `~/Desktop/Chaptr/src/theme/` (`index.ts`, `typography.ts`, `styles.ts`). Vanilla RN `StyleSheet` — no NativeWind/Tamagui. Web re-expresses these as CSS custom properties in `app/globals.css`.

### 4.1 Colors

| Token | Light | Dark |
| :--- | :--- | :--- |
| `background` | `#F8F5EF` | `#0C1014` |
| `surface` / `card` | `#FFFFFF` | `#141820` |
| `surfaceElevated` | `#FFFFFF` | `#1C2028` |
| `text.primary` | `#1F1F1F` | `#F2F2F2` |
| `text.secondary` | `#4D4D4D` | `#B3B3B3` |
| `text.tertiary` | `#757575` | `#808080` |
| `text.disabled` | `#A1A1A1` | `#4D4D4D` |
| `text.inverse` | `#FFFFFF` | `#0C1014` |
| `interactive.primary` | `#1D4E4B` | `#4A9E9A` |
| `interactive.primaryHover` | `#2A6B67` | `#5BB5B0` |
| `interactive.secondary` | `#F3F0EA` | `#1C2028` |
| `interactive.secondaryHover` | `#EBE7DF` | `#252A34` |
| `accent.brand` | `#1D4E4B` | `#4A9E9A` |
| `accent.brandLight` | `#2A6B67` | `#5BB5B0` |
| `accent.brandDark` | `#163835` | `#3A8885` |
| `accent.secondary` | `#C42847` | `#D94A66` |
| `accent.highlight` | `#FDF8F0` | `#1E1814` |
| `border.light` | `#F3F0EA` | — |
| `border.main` | `#E5E1D9` | `#282E38` |
| `border.dark` | `#D4D0C6` | — |
| `success.main` | `#2E7D4A` | `#5AAA75` |
| `warning.main` | `#B8860B` | — |
| `error.main` | `#C42847` | `#D94A66` |
| `info.main` | `#3D7A8C` | — |

Each status color is a 6-part object (`light`, `main`, `dark`, `background`, `text`, `border`) — see `src/theme/index.ts` for the full set.

### 4.2 Typography

Serif `Crimson Pro` for headings/book titles/identity; sans `Inter` for body/UI.

| Style | Family | Size | Tracking / leading |
| :--- | :--- | :--- | :--- |
| `heroTitle` | CrimsonPro Bold | 40 | `-1` |
| `sectionTitle` | CrimsonPro SemiBold | 34 | `-0.7` |
| `greeting` | CrimsonPro SemiBold | 32 | `-0.7` |
| `chapterTitle` | CrimsonPro SemiBold | 28 | `-0.5` |
| `userName` | CrimsonPro SemiBold | 26 | `-0.4` |
| `cardTitle` | CrimsonPro SemiBold | 22 | `-0.3` |
| `bookTitleLarge` | CrimsonPro SemiBold | 22 | `-0.3` |
| `bookTitle` | CrimsonPro Medium | 17 | `-0.2` |
| `subtitle` | Inter SemiBold | 18 | `-0.3` |
| `button` | Inter Bold | 18 | `+0.5` |
| `body` | Inter Regular | 17 | lh 26 |
| `bodyMedium` | Inter Medium | 16 | lh 24 |
| `label` | Inter SemiBold | 15 | |
| `caption` | Inter Medium | 13 | |

Loaded weights: CrimsonPro 300–700, Inter 100–900.

### 4.3 Spacing & radius

- **Spacing**: `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 20`, `2xl 24`, `3xl 32`, `4xl 40`, `5xl 48`
- **Radius**: `none 0`, `sm 6`, `base 8`, `md 10`, `lg 12`, `xl 16`, `2xl 20`, `full 999`
- Buttons override to `borderRadius: 16`; `screenPadding = spacing.lg`, `sectionSpacing = spacing['2xl']`

---

## 5. Key user flows

**5.1 Signup → onboarding.** `Welcome → SignUp` (email/password, OAuth, or phone OTP) → `on_auth_user_created` trigger inserts `public.users` with a username derived from metadata or the email local part → onboarding stack → `completeOnboarding` stamps `onboarding_completed_at` → `MainTabs`. Web gates the same way in `app/(app)/layout.tsx`.

**5.2 Create/join a club.** Join by invite code (`validateInviteCode` → `joinGroupByInviteCode`) or deep link `chaptr://join/:groupId` / `https://chaptrnote.com/join/:groupId` → `GroupPreview` → `joinGroup`. Create: name + book search + pace (`relaxed|moderate|intense`) → `createGroup` registers creator membership. Web mirrors this at `/join/[groupId]`.

**5.3 Log a chapter.** Home → `ChapterCompletion` → swipe to complete → text or audio reflection → vocabulary → `completeChapterAndUpdateProgress` writes `chapter_completions`, bumps streak/XP, optionally posts a discussion. See §1.4 for what web omits.

**5.4 Club chat.** `GroupDetail` → channel list (`currently_reading` is chapter-gated, plus `general` and `custom`) → `GroupChat` → realtime message stream → spoiler gate on future-chapter posts. Chapter gating is enforced **in the database** by RLS, not just UI.

**5.5 Moderation.** Report content → `reports` → auto-hide at a report threshold (`hidden_by_reports`) → admin queue approves/removes/dismisses → `moderation_actions`. Web has `/admin` but not the queue actions; note also that `reports`' admin-update policy is `using (false)`, so any admin write needs the service-role client.

---

## 6. Web-specific concerns

| Mobile capability | Web approach |
| :--- | :--- |
| Voice reflection (`src/lib/speechRecognition.ts`, `expo-av`) | Web Speech API or a cloud STT; audio upload to Supabase Storage |
| Image picking (`pickImageFromGallery`) for avatars + group banners | `<input type="file" accept="image/*">` |
| Offline cache (AsyncStorage + `@tanstack/react-query-persist-client`) | Not ported; Next.js Server Components fetch per request |
| Network monitoring (`@react-native-community/netinfo`) | `navigator.onLine` |
| Deep links (`chaptr://`, `chaptrnote.com`) | Real URLs — `/join/[groupId]` already matches |
| Push notifications (`user_push_tokens`, quiet hours) | Web Push, or drop |
| Presence (`presenceManager`, `isUserOnline`) | Supabase Realtime presence — not ported |
| Analytics (PostHog, Sentry, per-screen timers) | Not ported |

---

## 7. Parity backlog

Ordered by user-visible impact.

1. ~~Library schema (§2.1), channel reactions (§2.2), channel threading (§2.6)~~ — all fixed 2026-07-29.
2. **Premium channel gating on mobile.** `group_channels.is_premium` now exists and mobile's `getGroupChannels` does `select('*')`, but nothing in the RN app reads it — premium channels render to every member. Not urgent while `group_subscribers` is empty and checkout is a placeholder; blocking before paid groups ship. Best fixed with RLS on `group_channels`/`channel_messages` so both clients are gated by the database.
3. **Book details page** — `/library/[bookId]` doesn't exist; it's a dead end from every book cover.
4. **Chapter completion depth** — audio reflection, vocabulary, XP/celebration, post-as-discussion.
5. **Profile gamification** — XP, tiers, badges, achievements, milestones.
6. **Social graph** — follow/unfollow, blocked users, activity feed.
7. **Moderation queue** in `/admin`, via the service-role client.
8. **Notification settings** persisting to `user_notification_settings`; realtime notifications.
9. **Static/legal pages** — Terms, Privacy, Community Guidelines, Help. Terms and Privacy must be reachable pre-auth.
10. **Global search**, group banners, GDPR export, account deletion, phone/OTP auth.

Not a gap: mobile's paid-group layer doesn't exist, so web's Stripe work has no parity target — but it also means nothing on mobile surfaces premium channels to a subscriber.
