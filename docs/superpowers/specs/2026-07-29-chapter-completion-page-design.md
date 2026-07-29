# Chapter Completion Page — Design

Date: 2026-07-29
Status: Approved, ready for implementation planning

## Problem

On web, finishing a chapter is a single click. `handleCompleteChapter` in
`components/currently-reading/currently-reading-card.tsx:86` calls the
`completeChapter` server action directly: the counter ticks up by one, progress
advances, and that is the entire interaction. There is nowhere to capture what
you thought about the chapter.

The mobile app (`~/Desktop/Chaptr/src/screens/ChapterCompletionScreen.tsx`)
treats chapter completion as a destination. You land on a screen laid out like a
reading journal — a margin rule down the left, bullet notes beside it — capture
as many thoughts as you want, and only then complete the chapter. Web has none
of it.

This spec ports that screen to web, minus the voice-recording path.

## Scope

**In scope**

- A dedicated route for completing a chapter, with bullet-note capture.
- Chapter picker, so a user can jump to any chapter rather than only "next".
- Post-completion follow-up actions, at mobile parity.
- Rewiring the Currently Reading card to route here.

**Out of scope**

- Speech recognition / voice reflections. Web drops the mic entirely.
- The vocabulary modal. It exists only to feed contextual strings to the speech
  recognizer, so it leaves with the mic.
- Reading-insight banners (already commented out on mobile).
- Entry points from Library or the Group page. Home is the only entry point in
  this iteration.

## Route

```
app/(app)/read/[bookId]/chapter/[chapterNumber]/page.tsx   ?group=<groupId>
```

Lives under the `(app)` route group, so the existing `AppShell` chrome —
sidebar on desktop, bottom nav on mobile — stays in place. This is a page, not a
modal: the URL is bookmarkable and refreshable, and back/forward behave.

`chapterNumber` is a path segment rather than a query param because it is
genuinely part of the resource identity, and it lets the chapter picker work by
navigation.

### Server component responsibilities

`page.tsx` is a Server Component. It:

1. Resolves the user via `getAuthUser()`.
2. Fetches the book: `title, author, cover_url, total_chapters`.
3. Fetches the `reading_progress` row for `(user_id, book_id, group_id)`.
   `group_id` comes from `?group=`, defaulting to `null`.
4. Fetches every `personal_notes` row for `(user_id, book_id, chapter_number)`,
   ordered by `created_at` ascending.
5. Fetches `chapter_completions` chapter numbers for this user + book, so the
   picker can mark already-completed chapters.
6. When `?group=` is present, fetches the group's `name, primary_color`.

Guards:

- No `reading_progress` row → redirect to `/library`. You cannot log a chapter
  for a book you are not reading.
- `chapterNumber` outside `1..total_chapters` (or non-numeric) → `notFound()`.
- Books with a null `total_chapters` still work; the picker is hidden and the
  progress readout falls back to showing only the current percentage.

### Chapter picker navigates, it does not swap state

Mobile keeps the selected chapter in component state and resets the note list on
change. Web pushes a new URL instead:

```
router.push(`/read/${bookId}/chapter/${n}${groupParam}`)
```

The notes for the newly selected chapter then arrive from the server, the URL
stays truthful, and browser history works. Next.js handles this as a client-side
transition, so it is not a full page load.

## Component breakdown

| File | Responsibility |
| --- | --- |
| `app/(app)/read/[bookId]/chapter/[chapterNumber]/page.tsx` | Server: auth, fetch, guards |
| `app/(app)/read/[bookId]/chapter/[chapterNumber]/chapter-completion-client.tsx` | Orchestrator: owns the notes array, completion state, which modal is open |
| `components/chapter/chapter-header.tsx` | Book title, back chevron, chapter picker trigger, `20% → 30%` readout, animated progress bar |
| `components/chapter/chapter-picker.tsx` | Dropdown of Ch 1…N; check on current, subtle mark on completed chapters |
| `components/chapter/note-list.tsx` | Margin rule, dots, inline-editable bullets, empty state |
| `components/chapter/note-composer.tsx` | Hollow dot, auto-growing textarea, submit arrow |
| `components/chapter/post-completion-modal.tsx` | Share to discussion / View my notes / Chat with group / Keep private |
| `components/chapter/book-completion-modal.tsx` | Final-chapter celebration |

Each component takes plain props and holds no data-fetching of its own; the
client orchestrator is the only thing that calls server actions. `note-list` and
`note-composer` are separately testable against a notes array and a set of
callbacks.

`components/discussions/create-discussion-modal.tsx` is reused rather than
duplicated. It gains one optional prop, `initialContent?: string`, used to seed
its `content` state so the modal opens pre-filled with the chapter's bullets
joined by blank lines.

## Data model

Bullets are rows in `personal_notes`:

```
id, user_id, book_id, reading_progress_id, chapter_number,
note_content, note_type, is_private, created_at, updated_at
```

Each bullet is saved to the database the moment it is added, as
`note_type: 'snippet'` — nothing is held only in memory, so a refresh mid-session
loses nothing.

On completion, the chapter's snippets are **re-tagged** to
`note_type: 'chapter_completion'`. They are not merged and not deleted.

This is a deliberate divergence from mobile, which concatenates its snippets into
one dash-joined `chapter_completion` note and deletes the originals. Mobile's
approach means revisiting a completed chapter shows an empty note list, because
its loader filters on `note_type === 'snippet'`. That is tolerable on mobile,
where the screen is transient. On web the URL is bookmarkable and revisiting is
expected, so keeping one row per bullet — still individually editable after
completion — is the better fit. Mobile's Notes screen reads
`chapter_completion` notes without trouble either way, so the two apps stay
compatible.

## Server actions — `app/(app)/read/actions.ts`

All follow the established shape: resolve the user, return `{ error: string }`
on failure, `revalidatePath` every affected route, return `{ success: true }` or
the created id.

### `addChapterNote({ bookId, chapterNumber, content, groupId })`

Trims content, rejects empty. Looks up `reading_progress.id` for
`(user, book, group)` and sets it as `reading_progress_id`. Inserts with
`note_type: 'snippet'`, `is_private: true`. Returns the new row's `id` and
`created_at` so the client can replace its optimistic placeholder.

### `updateChapterNote(id, content)`

Updates `note_content` and `updated_at`, scoped by `.eq('user_id', user.id)`.

### `deleteChapterNote(id)`

Deletes, scoped by `.eq('user_id', user.id)`.

### `completeChapterWithNotes({ progressId, bookId, chapterNumber, groupId, noteIds })`

1. Re-tags the listed notes to `note_type: 'chapter_completion'` (scoped by
   `user_id`).
2. Delegates the completion record, progress update and streak bump to
   `logChapterCompletion` (see below).
3. `revalidatePath` for `/home`, `/library`, and the group page when scoped.

Returns `{ success: true, isFinalChapter: boolean, progressPercentage: number }`
so the client knows which modal to show and what to animate the bar toward.

### Extending `logChapterCompletion` rather than duplicating it

`logChapterCompletion` (`app/(app)/library/actions.ts:189`) already owns the
completion row, the progress update and the streak calculation. Two things are
missing for this flow, and the streak logic is far too intricate to copy.

It gains a fourth, optional options argument:

```ts
logChapterCompletion(
  progressId, bookId, chapterNumber,
  options?: { groupId?: string | null; reflectionText?: string; clampProgress?: boolean }
)
```

- `groupId` is written to `chapter_completions.group_id`. The function omits this
  column today, so group-attributed completions are being lost — the new flow
  passes it, and the column is nullable so existing callers are unaffected.
- `reflectionText` populates `chapter_completions.reflection_text` with the
  bullets joined by blank lines, matching what mobile records. The existing
  signature already accepts a fourth positional `reflectionText` param that no
  caller passes; it is folded into this options object.
- `clampProgress` addresses the real hazard. The function currently sets
  `current_chapter` and `completed_chapters` to the chapter number
  unconditionally. That is safe today because the only reachable action is "+1",
  but once the picker exists, logging Ch 3 while on Ch 9 would drag progress
  backwards and shrink the percentage. With `clampProgress: true`, both fields
  take `Math.max(existing, chapterNumber)` and `progress_percentage` is
  recomputed from the clamped value.

The `chapter_completions` row is always written for the chapter the user actually
picked, so history stays accurate — only the "how far along am I" fields are
monotonic.

The two existing callers (`notes-client.tsx:101` and, until it is deleted, the
`completeChapter` wrapper) pass no options and keep their current behaviour.

## Interaction design

### Capturing a note

The composer is a hollow dot beside an auto-growing textarea with an ↑ submit
button.

- **Enter** submits the bullet. **Shift+Enter** inserts a newline.
- The ↑ button appears only when there is trimmed content.
- On submit the textarea clears and keeps focus, so several thoughts can be
  entered in a row without reaching for the mouse.
- The bullet is inserted optimistically with a temporary id and a subdued style.
  When `addChapterNote` returns, the temp id is swapped for the real one. On
  failure the bullet is removed, the text is restored to the composer, and an
  inline error appears.

### Editing and deleting

- Clicking a bullet's text turns it into an inline textarea. Blur commits via
  `updateChapterNote`; Escape reverts to the previous value.
- Hovering a bullet reveals a trash button at its right edge — web's equivalent
  of mobile's swipe-to-delete. Keyboard users reach it via normal tab order.
- Deletion is optimistic, with the row restored if the action fails.

### The completion gate

"Complete Chapter" is disabled until at least one note exists, matching mobile.
The disabled state carries the hint *"Capture a thought to complete this
chapter"* so it never reads as broken. The chapter picker is what keeps this
from being a trap: a user who wants to log a different chapter jumps there
directly instead of being stuck.

### Completion

On success the notes view is replaced by a success state — a check badge,
"Chapter Complete!", and "*N* notes saved" — with a brief confetti burst. The
progress bar animates from the old percentage to the new one.

Then:

- **Final chapter** (`chapterNumber >= total_chapters`) → `book-completion-modal`,
  offering Rate this book / View group discussion (group context only) /
  Community discussions / Done.
- **Otherwise** → `post-completion-modal`, offering Share to discussion / View my
  notes / Chat with group (group context only) / Keep private.

Modal destinations: *Share to discussion* closes and opens the reused
`CreateDiscussionModal` pre-filled with the bullets. *View my notes* goes to
`/library/notes/[bookId]`. *Chat with group* goes to the group's chat.
*Keep private* and *Done* return to `/home`.

## Styling

Semantic tokens only — `bg-background`, `bg-[var(--surface)]`,
`text-[var(--text-primary)]`, `text-[var(--text-secondary)]`,
`border-[var(--border-main)]` — so the page is correct in both themes.

- Book title: `font-serif`, uppercase, tracked, `text-xs`, tertiary text colour.
- Chapter heading: `font-serif`, large, primary text colour, with a chevron
  indicating the picker.
- Note text: `font-sans`, base size, comfortable line height.
- The margin rule is a `border-l` on the notes column, with dots positioned to
  straddle it — filled for saved notes, hollow for the composer. This is what
  makes the page read as a reading journal rather than a form.
- The notes area scrolls; the composer and Complete button stay pinned at the
  bottom of the viewport on desktop and above the bottom nav on mobile.
- In group context, the progress bar fill uses the group's `primary_color`,
  falling back to the success token when the group has none.

## Entry point

`components/currently-reading/currently-reading-card.tsx:86` — `handleCompleteChapter`
is removed. The "Complete Chapter" button becomes a `Link` to:

```
/read/{book.id}/chapter/{completedChapters + 1}
```

with `?group={groupId}` appended when the card is showing a group-scoped read.

`completeChapter` in `app/(app)/home/actions.ts:7` becomes unused and is deleted.
`logChapterCompletion` stays — the library flow still calls it.

## Error handling

- Note add/update/delete failures are non-blocking: the optimistic change is
  reverted and an inline message appears next to the composer. The page stays
  usable.
- A `completeChapterWithNotes` failure leaves the page in its pre-completion
  state with an error above the button, so the user can retry. Notes are already
  persisted, so nothing is lost.
- Because notes are saved on entry rather than on completion, an abandoned
  session leaves the bullets in place for the next visit.

## Testing

The repo has no test suite, so verification is manual against a real book:

1. From `/home`, "Complete Chapter" navigates to the new route rather than
   incrementing in place.
2. Adding several bullets persists them; a hard refresh shows them all.
3. Editing and deleting bullets persist across a refresh.
4. Complete Chapter is disabled at zero notes, enabled at one.
5. Completing updates the home card's chapter and percentage.
6. Picking an earlier chapter and completing it does **not** reduce progress, but
   does write a `chapter_completions` row for that chapter.
7. Entering with `?group=` writes `group_id` on both the progress row lookup and
   the completion row.
8. Completing the final chapter shows the book-completion modal and marks the
   book completed.
9. The page is legible and usable in light and dark themes, at mobile and
   desktop widths.
