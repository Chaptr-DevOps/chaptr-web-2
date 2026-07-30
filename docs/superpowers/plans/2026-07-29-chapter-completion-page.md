# Chapter Completion Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the web app's one-click "Complete Chapter" with a dedicated page where the user captures bullet notes about the chapter before completing it, porting the mobile `ChapterCompletionScreen` minus voice recording.

**Architecture:** A new route `app/(app)/read/[bookId]/chapter/[chapterNumber]/page.tsx` (Server Component) loads the book, the user's reading progress, and that chapter's notes, then hands them to a client orchestrator. The orchestrator owns the notes array and calls server actions in `app/(app)/read/actions.ts`. Notes are rows in `personal_notes`, written the moment they are added and re-tagged on completion. The chapter picker navigates to a new URL rather than swapping client state.

**Tech Stack:** Next.js 15 App Router (async `params`/`searchParams`), React 19, Supabase JS via `@supabase/ssr`, Tailwind v4 with CSS-custom-property design tokens, shadcn primitives in `components/ui/`, `lucide-react` icons.

## Global Constraints

- **This repo has no test suite.** Do not add one — it is out of scope and would be a large unrelated change.
- **`pnpm build` does NOT typecheck.** `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so the build compiles straight past type errors. **The real gate is `npx tsc --noEmit`.**
- **The bar is "no type errors in the files this task touched", not "tsc is clean."** The working tree carries pre-existing type errors in unrelated files (`app/(app)/home/page.tsx`, `library-client.tsx`, `add-book-client.tsx`, and others). Those are not yours to fix. Verify with:
  ```bash
  npx tsc --noEmit 2>&1 | grep -E '<your task's file paths>' || echo "(clean)"
  ```
- **`pnpm lint` does not work either** — `eslint` is not installed in this repo (`package.json` declares the script but the dependency is absent). Do not try to fix that; it is out of scope. `npx tsc --noEmit` is the ONLY automated gate. Everything else is the manual browser checks listed in the task.
- Where a task says "Expected: PASS", it means no type errors attributable to the files you changed.
- **The working tree has ~49 pre-existing uncommitted files that are NOT yours.** `lib/types.ts`, `app/(app)/library/actions.ts`, `components/currently-reading/currently-reading-card.tsx` and others already carry unrelated in-progress work. Never run `git checkout --`, `git stash`, or `git restore` on any file. Only `git add` the exact paths your task's commit step names, and expect their diffs to contain changes you did not make — leave those alone.
- **Design tokens only.** Never hardcode colors. Use `bg-background`, `bg-[var(--surface)]`, `bg-[var(--surface-elevated)]`, `text-[var(--text-primary)]`, `text-[var(--text-secondary)]`, `text-[var(--text-tertiary)]`, `border-[var(--border-main)]`, `text-[var(--error)]`, `bg-primary`. The page must be correct in light and dark themes.
- **Fonts:** `font-serif` (Crimson Pro) for the chapter heading and book title; `font-sans` (Inter) for note text and UI.
- **Server action shape:** every action starts by resolving the user with `supabase.auth.getUser()`, returns `{ error: string }` on failure, returns `{ success: true }` or a created id on success, and calls `revalidatePath(...)` for every affected route before returning.
- **Always create the Supabase server client fresh per request** with `await createClient()` from `@/lib/supabase/server`. Never hoist it to a module-level singleton.
- **Every mutation is scoped by `.eq('user_id', user.id)`** in addition to the row id.
- `scripts/001_chaptr_schema.sql` is the source of truth for column names. It is documentation — never run it.
- Commit after every task, using the exact commit message given in the task.
- **Never write `res.error ?? null` or cast to silence a narrowing complaint.** The actions in `app/(app)/read/actions.ts` carry explicit `ActionResult` return annotations precisely so `if ('error' in res)` narrows `res.error` to `string`. If narrowing ever fails, the annotation is missing or wrong — fix that, and report it; do not paper over it at the call site.

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `app/(app)/read/actions.ts` | All server actions for the chapter page: add / update / delete a note, complete the chapter |
| `app/(app)/read/[bookId]/chapter/[chapterNumber]/page.tsx` | Server Component: auth, data fetch, guards |
| `app/(app)/read/[bookId]/chapter/[chapterNumber]/chapter-completion-client.tsx` | Client orchestrator: owns notes array + completion state, calls actions |
| `components/chapter/types.ts` | The `ChapterNote` shape, shared by the page, the orchestrator and the list |
| `components/chapter/chapter-header.tsx` | Book title, back link, picker trigger, progress readout + bar |
| `components/chapter/chapter-picker.tsx` | Dropdown of chapters; navigates on select |
| `components/chapter/note-list.tsx` | Margin rule, dots, inline-editable bullets, empty state |
| `components/chapter/note-composer.tsx` | Hollow dot, auto-growing textarea, submit arrow |
| `components/chapter/confetti-burst.tsx` | CSS-only celebration burst shown on completion |
| `components/chapter/post-completion-modal.tsx` | Share / View notes / Chat with group / Keep private |
| `components/chapter/book-completion-modal.tsx` | Final-chapter celebration |

**Modified:**

| File | Change |
| --- | --- |
| `lib/types.ts:125` | `PersonalNote` gains `note_type` and `reading_progress_id` |
| `app/(app)/library/actions.ts:189` | `logChapterCompletion` gains an options argument |
| `components/discussions/create-discussion-modal.tsx:13` | Gains optional `initialContent` prop |
| `components/currently-reading/currently-reading-card.tsx:86` | Button becomes a `Link` to the new route |
| `app/(app)/home/actions.ts:7` | `completeChapter` wrapper deleted |

---

### Task 1: Server actions and the `logChapterCompletion` options argument

**Files:**
- Modify: `lib/types.ts:125-134`
- Modify: `app/(app)/library/actions.ts:189-192` (signature) and its progress-update block
- Create: `app/(app)/read/actions.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; existing `logChapterCompletion`.
- Produces:
  - `logChapterCompletion(progressId: string, bookId: string, chapterNumber: number, options?: { groupId?: string | null; reflectionText?: string; clampProgress?: boolean }): Promise<{ error: string } | { success: true; isFinalChapter: boolean; progressPercentage: number }>`
  - `addChapterNote(params: { bookId: string; chapterNumber: number; content: string; groupId?: string | null }): Promise<{ error: string } | { success: true; id: string; createdAt: string }>`
  - `updateChapterNote(id: string, content: string): Promise<{ error: string } | { success: true }>`
  - `deleteChapterNote(id: string): Promise<{ error: string } | { success: true }>`
  - `completeChapterWithNotes(params: { progressId: string; bookId: string; chapterNumber: number; groupId?: string | null; noteIds: string[] }): Promise<{ error: string } | { success: true; isFinalChapter: boolean; progressPercentage: number }>`
  - `PersonalNote` gains `note_type: string | null` and `reading_progress_id: string | null`

- [ ] **Step 1: Add the missing `personal_notes` fields to the TypeScript interface**

The live table has `note_type` and `reading_progress_id` (see `scripts/001_chaptr_schema.sql:423-434`) but `lib/types.ts` omits both. In `lib/types.ts`, replace the `PersonalNote` interface with:

```ts
export interface PersonalNote {
  id: string
  user_id: string
  book_id: string
  reading_progress_id: string | null
  chapter_number: number | null
  note_content: string | null
  note_type: string | null
  is_private: boolean
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Give `logChapterCompletion` its options argument**

In `app/(app)/library/actions.ts`, replace the function signature (currently lines 189-194) with:

```ts
export async function logChapterCompletion(
  progressId: string,
  bookId: string,
  chapterNumber: number,
  options?: {
    groupId?: string | null
    reflectionText?: string
    clampProgress?: boolean
  }
): Promise<
  { error: string } | { success: true; isFinalChapter: boolean; progressPercentage: number }
> {
```

The explicit return annotation is required for the same reason as the `read/actions.ts`
actions: without it, TypeScript back-fills each branch with the other's keys as
optional, so `completeChapterWithNotes` cannot return `result.error` (it infers
`string | undefined`). Annotate it inline rather than importing `ActionResult`
from `read/actions.ts` — that file already imports *from* this one, so sharing a
type in the other direction would invert the dependency.

The old fourth positional parameter was `reflectionText?: string`. **One caller does pass it:** `app/(app)/library/notes/[bookId]/notes-client.tsx:105` passes a bare `reflection` string. Folding it into `options` breaks that call site, so you must update it in the same task — change the 4th argument from `reflection` to `{ reflectionText: reflection }`. Add that file to this task's commit.

**That same caller needs a second change.** It checks the result with a bare
truthiness test, `if (res.error)`. Once the return type is an explicit union, the
success branch has no `error` key at all, so that access is a type error
(`TS2339`). Change it to `in` narrowing, matching the pattern already used at
`app/(app)/groups/[groupId]/manage/manage-client.tsx:114`:

```tsx
      if ('error' in res) {
        alert(res.error)
      } else {
```

The rest of that `else` block stays exactly as it is.

- [ ] **Step 3: Write `group_id` and `reflection_text` on the completion row**

Still in `logChapterCompletion`, replace the `chapter_completions` insert (the block starting `const { error: completionError } = await supabase.from('chapter_completions').insert({`) with:

```ts
  const { error: completionError } = await supabase.from('chapter_completions').insert({
    user_id: user.id,
    book_id: bookId,
    group_id: options?.groupId ?? null,
    chapter_number: chapterNumber,
    reflection_text: options?.reflectionText?.trim() || null,
  })
```

`group_id` is nullable, so existing callers that pass no options behave exactly as before — except they now explicitly write `null` instead of omitting the column, which is the same result.

- [ ] **Step 4: Clamp the progress fields when asked**

Still in `logChapterCompletion`, the current code computes `progress_percentage` from `chapterNumber` and then builds `updatePayload`. Replace everything from `// Calculate percentage` down to the end of the `updatePayload` construction (i.e. up to but not including the `const { error: progressError }` block) with:

```ts
  // When clamping, progress may only move forward. Without this, using the
  // chapter picker to log an earlier chapter would drag the reader backwards.
  let effectiveChapter = chapterNumber
  if (options?.clampProgress) {
    const { data: existing } = await supabase
      .from('reading_progress')
      .select('current_chapter, completed_chapters')
      .eq('id', progressId)
      .eq('user_id', user.id)
      .maybeSingle()

    effectiveChapter = Math.max(
      chapterNumber,
      existing?.current_chapter ?? 0,
      existing?.completed_chapters ?? 0
    )
  }

  // Fetch the book to get total chapters
  const { data: book } = await supabase
    .from('books')
    .select('total_chapters, total_pages')
    .eq('id', bookId)
    .single()

  let progress_percentage = 0
  let isFinished = false
  if (book?.total_chapters) {
    progress_percentage = Math.min(
      100,
      Math.max(0, (effectiveChapter / book.total_chapters) * 100)
    )
    if (effectiveChapter >= book.total_chapters) {
      isFinished = true
    }
  }

  const updatePayload: Record<string, any> = {
    current_chapter: effectiveChapter,
    progress_percentage,
    completed_chapters: effectiveChapter,
    total_chapters: book?.total_chapters ?? null,
    last_read_at: new Date().toISOString(),
  }
  if (isFinished) {
    updatePayload.status = 'completed'
    updatePayload.completed_at = new Date().toISOString()
  }
```

Delete the now-duplicated original `const { data: book } = await supabase.from('books')...` fetch that sat above this block — the version inside the snippet replaces it. Keep the streak-update block and the `revalidatePath` calls below unchanged.

- [ ] **Step 5: Return the outcome the caller needs**

Still in `logChapterCompletion`, replace the final `return { success: true }` with:

```ts
  return { success: true, isFinalChapter: isFinished, progressPercentage: progress_percentage }
```

Existing callers ignore the extra fields, so this is safe.

- [ ] **Step 6: Create the chapter page's server actions**

Create `app/(app)/read/actions.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logChapterCompletion } from '../library/actions'

/**
 * Every action below carries an EXPLICIT return-type annotation, and that is
 * load-bearing. Without one, TypeScript infers each return branch separately and
 * back-fills the other branch's keys as optional — so at the call site
 * `if ('error' in res)` fails to narrow and `res.error` comes out
 * `string | undefined`. Callers then need `res.error ?? null` band-aids. With the
 * annotation, `in` narrowing works and callers can use `res.error` directly.
 */
type ActionResult<T = unknown> = { error: string } | ({ success: true } & T)

/** Looks up the reading_progress row id for a (user, book, group) triple. */
async function findProgressId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  bookId: string,
  groupId?: string | null
) {
  let query = supabase
    .from('reading_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', bookId)

  query = groupId ? query.eq('group_id', groupId) : query.is('group_id', null)

  const { data } = await query.maybeSingle()
  return data?.id ?? null
}

export async function addChapterNote(params: {
  bookId: string
  chapterNumber: number
  content: string
  groupId?: string | null
}): Promise<ActionResult<{ id: string; createdAt: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const content = params.content.trim()
  if (!content) return { error: 'Note cannot be empty' }

  const readingProgressId = await findProgressId(
    supabase,
    user.id,
    params.bookId,
    params.groupId
  )

  const { data, error } = await supabase
    .from('personal_notes')
    .insert({
      user_id: user.id,
      book_id: params.bookId,
      reading_progress_id: readingProgressId,
      chapter_number: params.chapterNumber,
      note_content: content,
      note_type: 'snippet',
      is_private: true,
    })
    .select('id, created_at')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/library/notes/${params.bookId}`)
  return { success: true as const, id: data.id, createdAt: data.created_at }
}

export async function updateChapterNote(id: string, content: string): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = content.trim()
  if (!trimmed) return { error: 'Note cannot be empty' }

  const { error } = await supabase
    .from('personal_notes')
    .update({ note_content: trimmed, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { success: true as const }
}

export async function deleteChapterNote(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('personal_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { success: true as const }
}

export async function completeChapterWithNotes(params: {
  progressId: string
  bookId: string
  chapterNumber: number
  groupId?: string | null
  noteIds: string[]
}): Promise<ActionResult<{ isFinalChapter: boolean; progressPercentage: number }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // A caller-supplied groupId must not let someone tag a group they are not a
  // member of — chapter_completions rows are readable by that group.
  if (params.groupId) {
    const { data: membership } = await supabase
      .from('group_memberships')
      .select('id')
      .eq('group_id', params.groupId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership) return { error: 'You are not a member of this group' }
  }

  // Log the completion FIRST. If it fails, the notes stay tagged 'snippet' and
  // nothing has been recorded — there is no transaction across these two calls.
  //
  // NOTE: reflectionText is deliberately NOT passed. chapter_completions has an
  // RLS policy granting SELECT to every active member of the row's group, so
  // anything in reflection_text on a group-scoped completion is visible to the
  // whole group. Bullet notes are private (personal_notes is owner-only) and
  // must never be copied there. Sharing is an explicit user action via the
  // discussion modal, never a side effect of completing a chapter.
  const result = await logChapterCompletion(
    params.progressId,
    params.bookId,
    params.chapterNumber,
    {
      groupId: params.groupId ?? null,
      clampProgress: true,
    }
  )

  if ('error' in result) return { error: result.error }

  // Re-tag this chapter's snippets rather than merging and deleting them, so
  // revisiting the chapter still shows the individual bullets.
  if (params.noteIds.length > 0) {
    const { error: tagError } = await supabase
      .from('personal_notes')
      .update({ note_type: 'chapter_completion', updated_at: new Date().toISOString() })
      .in('id', params.noteIds)
      .eq('user_id', user.id)

    if (tagError) return { error: tagError.message }
  }

  revalidatePath('/home')
  revalidatePath('/library')
  revalidatePath(`/library/notes/${params.bookId}`)
  if (params.groupId) revalidatePath(`/groups/${params.groupId}`)

  return {
    success: true as const,
    isFinalChapter: result.isFinalChapter,
    progressPercentage: result.progressPercentage,
  }
}
```

- [ ] **Step 7: Verify it compiles and lints**

Run: `npx tsc --noEmit` (see Global Constraints — the bar is no type errors in the files THIS task touched; pre-existing errors elsewhere are not yours)
Expected: PASS — no type errors in the files this task touched. If `tsc` reports an error on `logChapterCompletion`'s return being a union, confirm the two existing callers (`app/(app)/home/actions.ts:8` and `app/(app)/library/notes/[bookId]/notes-client.tsx:101`) only read `.error`; both already guard with `if (res.error)`, which narrows correctly.

- [ ] **Step 8: Commit**

```bash
git add lib/types.ts "app/(app)/library/actions.ts" "app/(app)/read/actions.ts"
git commit -m "Add chapter note server actions and logChapterCompletion options"
```

---

### Task 2: The route, its data loading, the header and the chapter picker

**Files:**
- Create: `components/chapter/types.ts`
- Create: `app/(app)/read/[bookId]/chapter/[chapterNumber]/page.tsx`
- Create: `app/(app)/read/[bookId]/chapter/[chapterNumber]/chapter-completion-client.tsx`
- Create: `components/chapter/chapter-header.tsx`
- Create: `components/chapter/chapter-picker.tsx`

**Interfaces:**
- Consumes: `PersonalNote` from Task 1; `createClient`, `getAuthUser`.
- Produces:
  - `ChapterNote = { id: string; content: string; pending?: boolean }` — exported from `components/chapter/types.ts`, used by Tasks 3 and 4.
  - `<ChapterCompletionClient>` props: `{ bookId, bookTitle, chapterNumber, totalChapters, progressId, groupId, groupColor, groupName, completedChapters, initialNotes: ChapterNote[] }`
  - `<ChapterHeader>` props: `{ bookId, bookTitle, chapterNumber, totalChapters, completedChapterNumbers: number[], fromPercent: number, toPercent: number, animatedPercent: number, accentColor: string | null, groupId: string | null }`
  - `<ChapterPicker>` props: `{ bookId, chapterNumber, totalChapters, completedChapterNumbers: number[], groupId: string | null }`

- [ ] **Step 1: Create the shared note type**

Create `components/chapter/types.ts`. Keeping this in `components/chapter/` rather than inside the route folder avoids a component under `components/` having to reach into `app/` for a type.

```ts
/** A single bullet note on the chapter completion page. */
export type ChapterNote = {
  id: string
  content: string
  /** True while an optimistic insert is still awaiting its real row id. */
  pending?: boolean
}
```

- [ ] **Step 2: Create the chapter picker**

Create `components/chapter/chapter-picker.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'

export function ChapterPicker({
  bookId,
  chapterNumber,
  totalChapters,
  completedChapterNumbers,
  groupId,
}: {
  bookId: string
  chapterNumber: number
  totalChapters: number
  completedChapterNumbers: number[]
  groupId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function select(n: number) {
    setOpen(false)
    if (n === chapterNumber) return
    const suffix = groupId ? `?group=${groupId}` : ''
    router.push(`/read/${bookId}/chapter/${n}${suffix}`)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--surface-elevated)]"
      >
        <span className="font-serif text-2xl font-bold text-[var(--text-primary)]">
          Chapter {chapterNumber}
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-1/2 z-50 mt-2 max-h-80 w-56 -translate-x-1/2 overflow-y-auto rounded-xl border border-[var(--border-main)] bg-[var(--surface)] py-1 shadow-2xl"
        >
          {Array.from({ length: totalChapters }, (_, i) => i + 1).map((n) => {
            const isCurrent = n === chapterNumber
            const isDone = completedChapterNumbers.includes(n)
            return (
              <button
                key={n}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => select(n)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--surface-elevated)] ${
                  isCurrent
                    ? 'font-semibold text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                <span className="flex items-center gap-2">
                  Chapter {n}
                  {isDone && !isCurrent && (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                      logged
                    </span>
                  )}
                </span>
                {isCurrent && <Check className="h-4 w-4" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create the header**

Create `components/chapter/chapter-header.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ChapterPicker } from './chapter-picker'

export function ChapterHeader({
  bookId,
  bookTitle,
  chapterNumber,
  totalChapters,
  completedChapterNumbers,
  fromPercent,
  toPercent,
  animatedPercent,
  accentColor,
  groupId,
}: {
  bookId: string
  bookTitle: string
  chapterNumber: number
  totalChapters: number
  completedChapterNumbers: number[]
  fromPercent: number
  toPercent: number
  animatedPercent: number
  accentColor: string | null
  groupId: string | null
}) {
  return (
    <header className="px-4 pt-4 pb-3">
      <p className="mb-1 text-center font-serif text-xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        {bookTitle}
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <Link
            href="/home"
            aria-label="Back to home"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg -ml-2 transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <ChevronLeft className="h-6 w-6 text-[var(--text-primary)]" />
          </Link>
        </div>

        <div className="flex flex-[3] justify-center">
          {totalChapters > 0 ? (
            <ChapterPicker
              bookId={bookId}
              chapterNumber={chapterNumber}
              totalChapters={totalChapters}
              completedChapterNumbers={completedChapterNumbers}
              groupId={groupId}
            />
          ) : (
            <span className="font-serif text-2xl font-bold text-[var(--text-primary)]">
              Chapter {chapterNumber}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col items-end">
          <span className="mb-1 text-xs text-[var(--text-secondary)] tabular-nums">
            {fromPercent}% → {toPercent}%
          </span>
          <div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--border-main)]">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${animatedPercent}%`,
                backgroundColor: accentColor ?? 'var(--success)',
              }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Create the client orchestrator shell**

Create `app/(app)/read/[bookId]/chapter/[chapterNumber]/chapter-completion-client.tsx`. This task establishes the shell and header wiring only; Tasks 3 and 4 fill in the notes body and the completion flow.

```tsx
'use client'

import { useState } from 'react'
import { ChapterHeader } from '@/components/chapter/chapter-header'
import type { ChapterNote } from '@/components/chapter/types'

export interface ChapterCompletionClientProps {
  bookId: string
  bookTitle: string
  chapterNumber: number
  totalChapters: number
  progressId: string
  groupId: string | null
  groupColor: string | null
  groupName: string | null
  completedChapterNumbers: number[]
  initialNotes: ChapterNote[]
}

export function ChapterCompletionClient(props: ChapterCompletionClientProps) {
  const { bookId, bookTitle, chapterNumber, totalChapters, groupId, groupColor } = props

  const [notes, setNotes] = useState<ChapterNote[]>(props.initialNotes)

  const fromPercent = totalChapters
    ? Math.max(0, Math.round(((chapterNumber - 1) / totalChapters) * 100))
    : 0
  const toPercent = totalChapters
    ? Math.min(100, Math.round((chapterNumber / totalChapters) * 100))
    : 0

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <ChapterHeader
        bookId={bookId}
        bookTitle={bookTitle}
        chapterNumber={chapterNumber}
        totalChapters={totalChapters}
        completedChapterNumbers={props.completedChapterNumbers}
        fromPercent={fromPercent}
        toPercent={toPercent}
        animatedPercent={fromPercent}
        accentColor={groupColor}
        groupId={groupId}
      />

      <div className="flex-1 px-4 py-6 text-sm text-[var(--text-tertiary)]">
        {notes.length} note{notes.length === 1 ? '' : 's'} loaded
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create the page**

Create `app/(app)/read/[bookId]/chapter/[chapterNumber]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/queries'
import type { ChapterNote } from '@/components/chapter/types'
import { ChapterCompletionClient } from './chapter-completion-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ bookId: string; chapterNumber: string }>
  searchParams: Promise<{ group?: string }>
}

export default async function ChapterCompletionPage({ params, searchParams }: PageProps) {
  const { bookId, chapterNumber: chapterParam } = await params
  const { group } = await searchParams
  const groupId = group ?? null

  const user = await getAuthUser()
  if (!user) redirect('/signin')

  const chapterNumber = Number(chapterParam)
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) notFound()

  const supabase = await createClient()

  const { data: book } = await supabase
    .from('books')
    .select('id, title, author, cover_image_url, total_chapters')
    .eq('id', bookId)
    .maybeSingle()

  if (!book) notFound()

  let progressQuery = supabase
    .from('reading_progress')
    .select('id, current_chapter, completed_chapters, total_chapters')
    .eq('user_id', user.id)
    .eq('book_id', bookId)

  progressQuery = groupId
    ? progressQuery.eq('group_id', groupId)
    : progressQuery.is('group_id', null)

  const { data: progress } = await progressQuery.maybeSingle()

  // You cannot log a chapter for a book you are not reading.
  if (!progress) redirect('/library')

  const totalChapters = progress.total_chapters ?? book.total_chapters ?? 0
  if (totalChapters > 0 && chapterNumber > totalChapters) notFound()

  const { data: noteRows } = await supabase
    .from('personal_notes')
    .select('id, note_content')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .eq('chapter_number', chapterNumber)
    .order('created_at', { ascending: true })

  const initialNotes: ChapterNote[] = (noteRows ?? [])
    .filter((n) => n.note_content)
    .map((n) => ({ id: n.id, content: n.note_content as string }))

  const { data: completions } = await supabase
    .from('chapter_completions')
    .select('chapter_number')
    .eq('user_id', user.id)
    .eq('book_id', bookId)

  const completedChapterNumbers = [
    ...new Set((completions ?? []).map((c) => c.chapter_number)),
  ]

  let groupName: string | null = null
  let groupColor: string | null = null
  if (groupId) {
    const { data: groupRow } = await supabase
      .from('reading_groups')
      .select('name, primary_color')
      .eq('id', groupId)
      .maybeSingle()
    groupName = groupRow?.name ?? null
    groupColor = groupRow?.primary_color ?? null
  }

  return (
    // The key is load-bearing. The chapter picker navigates between chapters,
    // which re-renders this Server Component with fresh initialNotes — but the
    // client component sits at the same tree position, so React would preserve
    // its instance and `useState(props.initialNotes)` would keep showing the
    // PREVIOUS chapter's notes. Keying on the chapter forces a fresh instance.
    <ChapterCompletionClient
      key={`${book.id}:${chapterNumber}`}
      bookId={book.id}
      bookTitle={book.title}
      chapterNumber={chapterNumber}
      totalChapters={totalChapters}
      progressId={progress.id}
      groupId={groupId}
      groupColor={groupColor}
      groupName={groupName}
      completedChapterNumbers={completedChapterNumbers}
      initialNotes={initialNotes}
    />
  )
}
```

- [ ] **Step 6: Verify it compiles and lints**

Run: `npx tsc --noEmit` (see Global Constraints — the bar is no type errors in the files THIS task touched; pre-existing errors elsewhere are not yours)
Expected: PASS.

- [ ] **Step 7: Verify in the browser**

Run `pnpm dev`, then find a book you are currently reading (its id is in the URL of `/library/notes/<bookId>`). Visit `/read/<bookId>/chapter/1`.

Confirm all of the following:
1. The AppShell sidebar (desktop) / bottom nav (mobile) is still present.
2. The book title shows above, uppercase and tracked; "Chapter 1" shows in serif with a chevron.
3. The right side shows `0% → N%` with a small progress bar.
4. Clicking "Chapter 1" opens a dropdown listing every chapter, with a check on chapter 1.
5. Picking chapter 3 changes the URL to `/read/<bookId>/chapter/3` and the heading updates.
6. Clicking outside the dropdown, or pressing Escape, closes it.
7. Visiting `/read/<bookId>/chapter/999` shows the 404 page.
8. Toggle dark mode — all text stays legible and no hardcoded colors appear.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/read" components/chapter
git commit -m "Add chapter completion route with header and chapter picker"
```

---

### Task 3: Note list and composer

**Files:**
- Create: `components/chapter/note-list.tsx`
- Create: `components/chapter/note-composer.tsx`
- Modify: `app/(app)/read/[bookId]/chapter/[chapterNumber]/chapter-completion-client.tsx`

**Interfaces:**
- Consumes: `ChapterNote` from Task 2; `addChapterNote`, `updateChapterNote`, `deleteChapterNote` from Task 1.
- Produces:
  - `<NoteList>` props: `{ notes: ChapterNote[], onEdit: (id: string, content: string) => void, onDelete: (id: string) => void, readOnly?: boolean }`
  - `<NoteComposer>` props: `{ onSubmit: (content: string) => void, error: string | null }`

- [ ] **Step 1: Create the note list**

Create `components/chapter/note-list.tsx`. The margin rule is a `border-l` on the column, with the dots positioned to straddle it — this is what makes the page read as a reading journal rather than a form.

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { ChapterNote } from './types'

function NoteRow({
  note,
  onEdit,
  onDelete,
  readOnly,
}: {
  note: ChapterNote
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setDraft(note.content), [note.content])

  useEffect(() => {
    if (!editing) return
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing])

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (!trimmed || trimmed === note.content) {
      setDraft(note.content)
      return
    }
    onEdit(note.id, trimmed)
  }

  return (
    <li className="group relative flex gap-3 py-2.5">
      <span
        aria-hidden
        className={`mt-2 h-2 w-2 shrink-0 -translate-x-[calc(0.25rem+0.5px)] rounded-full ${
          note.pending ? 'bg-[var(--text-tertiary)]' : 'bg-primary'
        }`}
      />

      {editing && !readOnly ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${e.target.scrollHeight}px`
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(note.content)
              setEditing(false)
            }
          }}
          className="w-full resize-none bg-transparent font-sans text-[15px] leading-relaxed text-[var(--text-primary)] outline-none"
          rows={1}
        />
      ) : (
        <button
          type="button"
          disabled={readOnly || note.pending}
          onClick={() => setEditing(true)}
          className={`flex-1 whitespace-pre-wrap text-left font-sans text-[15px] leading-relaxed ${
            note.pending ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'
          }`}
        >
          {note.content}
        </button>
      )}

      {!readOnly && !editing && !note.pending && (
        <button
          type="button"
          onClick={() => onDelete(note.id)}
          aria-label="Delete note"
          className="shrink-0 rounded-md p-1.5 text-[var(--text-tertiary)] opacity-0 transition-opacity hover:text-[var(--error)] focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}

export function NoteList({
  notes,
  onEdit,
  onDelete,
  readOnly,
}: {
  notes: ChapterNote[]
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
  readOnly?: boolean
}) {
  if (notes.length === 0) {
    return (
      <div className="border-l border-[var(--border-main)] pl-4">
        <div className="flex gap-3 py-2.5">
          <span
            aria-hidden
            className="mt-2 h-2 w-2 shrink-0 -translate-x-[calc(0.25rem+0.5px)] rounded-full border border-[var(--border-main)]"
          />
          <div>
            <p className="font-sans text-[15px] font-medium text-[var(--text-primary)]">
              No notes yet
            </p>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              Capture a quick thought below as you read. Add as many as you want
              before completing.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ul className="border-l border-[var(--border-main)] pl-4">
      {notes.map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          onEdit={onEdit}
          onDelete={onDelete}
          readOnly={readOnly}
        />
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Create the composer**

Create `components/chapter/note-composer.tsx`. Enter submits, Shift+Enter inserts a newline, and focus stays put so several thoughts can be entered in a row.

```tsx
'use client'

import { useRef, useState } from 'react'
import { ArrowUpCircle } from 'lucide-react'

export function NoteComposer({
  onSubmit,
  error,
}: {
  onSubmit: (content: string) => void
  error: string | null
}) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
    requestAnimationFrame(() => {
      resize()
      textareaRef.current?.focus()
    })
  }

  return (
    <div>
      <div className="border-l border-[var(--border-main)] pl-4">
        <div className="flex items-start gap-3 py-2.5">
          <span
            aria-hidden
            className="mt-2 h-2 w-2 shrink-0 -translate-x-[calc(0.25rem+0.5px)] rounded-full border border-[var(--border-main)] bg-background"
          />
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            placeholder="Capture a thought..."
            aria-label="Capture a thought"
            onChange={(e) => {
              setValue(e.target.value)
              resize()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            className="w-full resize-none bg-transparent font-sans text-[15px] leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
          {value.trim().length > 0 && (
            <button
              type="button"
              onClick={submit}
              aria-label="Add note"
              className="shrink-0 rounded-full p-0.5 text-primary transition-opacity hover:opacity-80"
            >
              <ArrowUpCircle className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 pl-4 text-sm text-[var(--error)]">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Wire the notes into the orchestrator**

In `chapter-completion-client.tsx`, replace the imports and the whole component body (keep the `ChapterCompletionClientProps` interface exactly as it is) with:

```tsx
'use client'

import { useState } from 'react'
import { ChapterHeader } from '@/components/chapter/chapter-header'
import { NoteList } from '@/components/chapter/note-list'
import { NoteComposer } from '@/components/chapter/note-composer'
import type { ChapterNote } from '@/components/chapter/types'
import {
  addChapterNote,
  updateChapterNote,
  deleteChapterNote,
} from '@/app/(app)/read/actions'

export function ChapterCompletionClient(props: ChapterCompletionClientProps) {
  const { bookId, bookTitle, chapterNumber, totalChapters, groupId, groupColor } = props

  const [notes, setNotes] = useState<ChapterNote[]>(props.initialNotes)
  const [noteError, setNoteError] = useState<string | null>(null)

  const fromPercent = totalChapters
    ? Math.max(0, Math.round(((chapterNumber - 1) / totalChapters) * 100))
    : 0
  const toPercent = totalChapters
    ? Math.min(100, Math.round((chapterNumber / totalChapters) * 100))
    : 0

  async function handleAdd(content: string) {
    setNoteError(null)
    const tempId = `temp-${Date.now()}`
    setNotes((prev) => [...prev, { id: tempId, content, pending: true }])

    const res = await addChapterNote({ bookId, chapterNumber, content, groupId })

    if ('error' in res) {
      setNotes((prev) => prev.filter((n) => n.id !== tempId))
      setNoteError(res.error)
      return
    }

    setNotes((prev) =>
      prev.map((n) => (n.id === tempId ? { id: res.id, content } : n))
    )
  }

  async function handleEdit(id: string, content: string) {
    setNoteError(null)
    const previous = notes
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)))

    const res = await updateChapterNote(id, content)
    if ('error' in res) {
      setNotes(previous)
      setNoteError(res.error)
    }
  }

  async function handleDelete(id: string) {
    setNoteError(null)
    const previous = notes
    setNotes((prev) => prev.filter((n) => n.id !== id))

    const res = await deleteChapterNote(id)
    if ('error' in res) {
      setNotes(previous)
      setNoteError(res.error)
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <ChapterHeader
        bookId={bookId}
        bookTitle={bookTitle}
        chapterNumber={chapterNumber}
        totalChapters={totalChapters}
        completedChapterNumbers={props.completedChapterNumbers}
        fromPercent={fromPercent}
        toPercent={toPercent}
        animatedPercent={fromPercent}
        accentColor={groupColor}
        groupId={groupId}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <NoteList notes={notes} onEdit={handleEdit} onDelete={handleDelete} />
      </div>

      <div className="border-t border-[var(--border-main)] bg-background px-4 pb-6 pt-4">
        <NoteComposer onSubmit={handleAdd} error={noteError} />
      </div>
    </div>
  )
}
```

Keep the `export interface ChapterCompletionClientProps` declaration above the component untouched.

- [ ] **Step 4: Verify it compiles and lints**

Run: `npx tsc --noEmit` (see Global Constraints — the bar is no type errors in the files THIS task touched; pre-existing errors elsewhere are not yours)
Expected: PASS.

- [ ] **Step 5: Verify in the browser**

With `pnpm dev` running, visit `/read/<bookId>/chapter/1` and confirm:
1. The empty state reads "No notes yet" with a hollow dot on the margin rule.
2. Typing a thought and pressing **Enter** adds a bullet; the textarea clears and keeps focus.
3. Shift+Enter inserts a newline instead of submitting.
4. The new bullet briefly appears dimmed (pending), then becomes solid.
5. Adding three notes in a row works without touching the mouse.
6. Hard-refresh the page — all three notes are still there, in order.
7. Click a note's text: it becomes editable. Change it, click away — the change persists across a refresh. Press Escape mid-edit: it reverts.
8. Hover a note: a trash icon appears at the right. Click it — the note disappears and stays gone after a refresh.
9. In dark mode the margin rule, dots and text are all legible.

- [ ] **Step 6: Commit**

```bash
git add components/chapter "app/(app)/read"
git commit -m "Add chapter note list and composer"
```

---

### Task 4: Completion flow, gate and success state

**Files:**
- Create: `components/chapter/confetti-burst.tsx`
- Modify: `app/(app)/read/[bookId]/chapter/[chapterNumber]/chapter-completion-client.tsx`

**Interfaces:**
- Consumes: `completeChapterWithNotes` from Task 1; `NoteList`, `NoteComposer` from Task 3.
- Produces: local state `completed: boolean` and `isFinalChapter: boolean`, read by Task 5's modals.
- `<ConfettiBurst>` props: `{ show: boolean }`

- [ ] **Step 1: Create the confetti burst**

Create `components/chapter/confetti-burst.tsx`. This is pure CSS — no animation library — and respects `prefers-reduced-motion`.

```tsx
'use client'

const PIECES = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i * 4 + 4) % 100}%`,
  delay: `${(i % 8) * 60}ms`,
  color: ['var(--success)', 'var(--primary)', 'var(--warning)', 'var(--error)'][i % 4],
  size: i % 3 === 0 ? 10 : 12,
}))

export function ConfettiBurst({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="chaptr-confetti absolute top-0 rounded-[2px]"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
          }}
        />
      ))}

      <style jsx>{`
        .chaptr-confetti {
          animation: chaptr-confetti-fall 2s ease-in forwards;
          opacity: 0;
        }
        @keyframes chaptr-confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(540deg);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .chaptr-confetti {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
```

If `--warning` and `--primary` are not defined as raw custom properties in `app/globals.css`, substitute `var(--success-strong)` and `var(--error-strong)` respectively — check with `grep -n -- "--warning:\|--primary:" app/globals.css` before writing the file.

- [ ] **Step 2: Add completion state and the handler**

In `chapter-completion-client.tsx`, add to the imports:

```tsx
import { CheckCircle2, Loader2 } from 'lucide-react'
import { completeChapterWithNotes } from '@/app/(app)/read/actions'
import { ConfettiBurst } from '@/components/chapter/confetti-burst'
```

Then, inside the component after the `noteError` state, add:

```tsx
  const [completed, setCompleted] = useState(false)
  const [isFinalChapter, setIsFinalChapter] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [animatedPercent, setAnimatedPercent] = useState(fromPercent)

  const savedNotes = notes.filter((n) => !n.pending)
  const canComplete = savedNotes.length > 0 && !completing

  async function handleComplete() {
    if (!canComplete) return
    setCompleteError(null)
    setCompleting(true)

    const res = await completeChapterWithNotes({
      progressId: props.progressId,
      bookId,
      chapterNumber,
      groupId,
      noteIds: savedNotes.map((n) => n.id),
    })

    setCompleting(false)

    if ('error' in res) {
      setCompleteError(res.error)
      return
    }

    setIsFinalChapter(res.isFinalChapter)
    setCompleted(true)
    setShowConfetti(true)
    window.setTimeout(() => setShowConfetti(false), 2500)
    // Let the bar animate to the value the server actually recorded.
    requestAnimationFrame(() => setAnimatedPercent(Math.round(res.progressPercentage)))
  }
```

Note `animatedPercent` must be declared *after* `fromPercent`, which is already computed above the handlers.

- [ ] **Step 3: Feed the animated percentage to the header**

In the same file, change the `<ChapterHeader ... animatedPercent={fromPercent} />` prop to:

```tsx
        animatedPercent={animatedPercent}
```

- [ ] **Step 4: Render the success state and the complete button**

Replace the JSX below `<ChapterHeader ... />` (the `<div className="flex-1 overflow-y-auto ...">` and the bottom bar `<div>`) with:

```tsx
      <ConfettiBurst show={showConfetti} />

      {completed ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-elevated)]">
            <CheckCircle2 className="h-8 w-8 text-[var(--success)]" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
            Chapter Complete!
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {savedNotes.length} note{savedNotes.length === 1 ? '' : 's'} saved
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <NoteList notes={notes} onEdit={handleEdit} onDelete={handleDelete} />
          </div>

          <div className="border-t border-[var(--border-main)] bg-background px-4 pb-6 pt-4">
            <NoteComposer onSubmit={handleAdd} error={noteError} />

            {completeError && (
              <p className="mt-3 text-sm text-[var(--error)]">{completeError}</p>
            )}

            <button
              type="button"
              onClick={handleComplete}
              disabled={!canComplete}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-[15px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {completing && <Loader2 className="h-4 w-4 animate-spin" />}
              {completing ? 'Saving...' : 'Complete Chapter'}
            </button>

            {savedNotes.length === 0 && (
              <p className="mt-2 text-center text-xs text-[var(--text-tertiary)]">
                Capture a thought to complete this chapter
              </p>
            )}
          </div>
        </>
      )}
```

- [ ] **Step 5: Verify it compiles and lints**

Run: `npx tsc --noEmit` (see Global Constraints — the bar is no type errors in the files THIS task touched; pre-existing errors elsewhere are not yours)
Expected: PASS.

- [ ] **Step 6: Verify in the browser**

Pick a book where you can afford to advance progress. Visit `/read/<bookId>/chapter/<current+1>` and confirm:
1. With zero notes, "Complete Chapter" is visibly disabled and the hint "Capture a thought to complete this chapter" is shown.
2. Adding one note enables the button and hides the hint.
3. Clicking it shows a spinner, then the "Chapter Complete! — 1 note saved" success state.
4. A confetti burst falls across the screen and clears itself after ~2.5s.
5. The header progress bar animates forward to the new percentage.
6. Going to `/home`, the Currently Reading card shows the new chapter number and percentage.
7. Returning to `/read/<bookId>/chapter/<that chapter>` still shows the bullets — this is the deliberate divergence from mobile, which would show none.
8. **The clamp:** note your current chapter (say 5). Visit `/read/<bookId>/chapter/2`, add a note, complete it. Go to `/home` — the card must still read chapter 5, **not** chapter 2. Progress must not have gone backwards.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/read" components/chapter
git commit -m "Add chapter completion flow with notes gate and success state"
```

---

### Task 5: Post-completion and book-completion modals

**Files:**
- Create: `components/chapter/post-completion-modal.tsx`
- Create: `components/chapter/book-completion-modal.tsx`
- Modify: `components/discussions/create-discussion-modal.tsx:13-36`
- Modify: `app/(app)/read/[bookId]/chapter/[chapterNumber]/chapter-completion-client.tsx`

**Interfaces:**
- Consumes: `completed` / `isFinalChapter` state from Task 4; existing `CreateDiscussionModal`.
- Produces:
  - `<PostCompletionModal>` props: `{ open, onClose, chapterNumber, noteCount, bookId, groupId, groupName, onShare }`
  - `<BookCompletionModal>` props: `{ open, onClose, bookTitle, bookId, groupId, onShare }`
  - `CreateDiscussionModal` gains `initialContent?: string`

- [ ] **Step 1: Let the discussion modal open pre-filled**

In `components/discussions/create-discussion-modal.tsx`, add `initialContent` to the props destructuring and type (it currently ends with `groupName`):

```tsx
export function CreateDiscussionModal({
  open,
  onClose,
  bookId,
  currentChapter,
  groupId,
  groupName,
  initialContent,
}: {
  open: boolean
  onClose: () => void
  bookId: string
  currentChapter: number
  groupId?: string | null
  groupName?: string | null
  initialContent?: string
}) {
```

Then change the `content` state initializer from `useState('')` to:

```tsx
  const [content, setContent] = useState(initialContent ?? '')
```

Every existing caller omits the prop and is unaffected.

- [ ] **Step 2: Create the post-completion modal**

Create `components/chapter/post-completion-modal.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, MessageCircle, MessageSquare, X } from 'lucide-react'

export function PostCompletionModal({
  open,
  onClose,
  chapterNumber,
  noteCount,
  bookId,
  groupId,
  groupName,
  onShare,
}: {
  open: boolean
  onClose: () => void
  chapterNumber: number
  noteCount: number
  bookId: string
  groupId: string | null
  groupName: string | null
  onShare: () => void
}) {
  const router = useRouter()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Chapter complete"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
              Chapter {chapterNumber} logged
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {noteCount} note{noteCount === 1 ? '' : 's'} saved. What next?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onShare}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4 text-left transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <MessageSquare className="h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                Share to discussion
              </span>
              <span className="block text-xs text-[var(--text-secondary)]">
                Start a thread with what you wrote
              </span>
            </span>
          </button>

          <Link
            href={`/library/notes/${bookId}`}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <BookOpen className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
            <span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                View my notes
              </span>
              <span className="block text-xs text-[var(--text-secondary)]">
                Everything you&apos;ve captured for this book
              </span>
            </span>
          </Link>

          {groupId && (
            <Link
              href={`/groups/${groupId}`}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
              <span>
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  Chat with {groupName ?? 'your group'}
                </span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  See what everyone else is saying
                </span>
              </span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => router.push('/home')}
            className="w-full rounded-xl py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Keep it private
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create the book-completion modal**

Create `components/chapter/book-completion-modal.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle, MessageSquare, Sparkles } from 'lucide-react'

export function BookCompletionModal({
  open,
  onClose,
  bookTitle,
  bookId,
  groupId,
  onShare,
}: {
  open: boolean
  onClose: () => void
  bookTitle: string
  bookId: string
  groupId: string | null
  onShare: () => void
}) {
  const router = useRouter()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Book complete"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-elevated)]">
          <Sparkles className="h-8 w-8 text-[var(--success)]" />
        </div>

        <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
          You finished it
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{bookTitle}</p>

        <div className="mt-6 space-y-2 text-left">
          <button
            type="button"
            onClick={onShare}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <MessageSquare className="h-5 w-5 shrink-0 text-primary" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Share your final thoughts
            </span>
          </button>

          {groupId && (
            <Link
              href={`/groups/${groupId}`}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                View group discussion
              </span>
            </Link>
          )}

          <Link
            href={`/library/notes/${bookId}`}
            className="flex w-full items-center justify-center rounded-xl py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Review my notes
          </Link>
        </div>

        <button
          type="button"
          onClick={() => router.push('/home')}
          className="mt-2 w-full rounded-xl py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          Done
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire the modals into the orchestrator**

In `chapter-completion-client.tsx`, add to the imports:

```tsx
import { PostCompletionModal } from '@/components/chapter/post-completion-modal'
import { BookCompletionModal } from '@/components/chapter/book-completion-modal'
import { CreateDiscussionModal } from '@/components/discussions/create-discussion-modal'
```

Add this state next to the other `useState` calls:

```tsx
  const [modal, setModal] = useState<'none' | 'post' | 'book' | 'discussion'>('none')
```

In `handleComplete`, immediately after `setShowConfetti(true)`, add:

```tsx
    setModal(res.isFinalChapter ? 'book' : 'post')
```

Then add this block just before the closing `</div>` of the component's root element:

```tsx
      <PostCompletionModal
        open={modal === 'post'}
        onClose={() => setModal('none')}
        chapterNumber={chapterNumber}
        noteCount={savedNotes.length}
        bookId={bookId}
        groupId={groupId}
        groupName={props.groupName}
        onShare={() => setModal('discussion')}
      />

      <BookCompletionModal
        open={modal === 'book'}
        onClose={() => setModal('none')}
        bookTitle={bookTitle}
        bookId={bookId}
        groupId={groupId}
        onShare={() => setModal('discussion')}
      />

      <CreateDiscussionModal
        open={modal === 'discussion'}
        onClose={() => setModal('none')}
        bookId={bookId}
        currentChapter={chapterNumber}
        groupId={groupId}
        groupName={props.groupName}
        initialContent={savedNotes.map((n) => n.content).join('\n\n')}
      />
```

`isFinalChapter` from Task 4 is now consumed: `handleComplete` sets it, and it is what the `setModal` line above branches on. Note the modal state is separate from `completed` on purpose — closing a modal must leave the success state visible underneath rather than reverting the page.

- [ ] **Step 5: Verify it compiles and lints**

Run: `npx tsc --noEmit` (see Global Constraints — the bar is no type errors in the files THIS task touched; pre-existing errors elsewhere are not yours)
Expected: PASS.

- [ ] **Step 6: Verify in the browser**

1. Complete a non-final chapter with two notes. The post-completion modal appears over the success state.
2. "Share to discussion" swaps to the discussion modal, **pre-filled** with both notes separated by a blank line.
3. Posting the discussion works and navigates as it normally does.
4. "View my notes" goes to `/library/notes/<bookId>` and the notes are listed there.
5. "Keep it private" returns to `/home`.
6. Clicking the backdrop or the X closes the modal, leaving the success state visible.
7. With `?group=<groupId>` in the URL, a "Chat with <group name>" option appears; without it, that option is absent.
8. Complete the **final** chapter of a book: the book-completion modal appears instead, and `/library` shows the book as completed.
9. Both modals are legible in dark mode.

- [ ] **Step 7: Commit**

```bash
git add components/chapter components/discussions "app/(app)/read"
git commit -m "Add post-completion and book-completion modals"
```

---

### Task 6: Route the Currently Reading card to the new page

**Files:**
- Modify: `components/currently-reading/currently-reading-card.tsx:11,86-95,323-334`
- Modify: `app/(app)/home/actions.ts:1-9`

**Interfaces:**
- Consumes: the route from Task 2.
- Produces: nothing downstream. This is the final wiring.

- [ ] **Step 1: Turn the button into a link**

In `components/currently-reading/currently-reading-card.tsx`, replace the `<button>` element that starts `onClick={handleCompleteChapter}` (around line 323) with a `Link`, preserving the bookmark badge exactly:

```tsx
          <Link
            href={`/read/${book.id}/chapter/${completedChapters + 1}${
              progress.group_id ? `?group=${progress.group_id}` : ''
            }`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-main)] bg-[var(--background)] py-4 shadow-sm transition-colors hover:bg-[var(--surface-elevated)]"
          >
            <span className="text-[15px] font-semibold text-[var(--text-primary)]">Complete Chapter</span>
            <span className="relative flex h-7 w-[22px] items-start justify-center rounded-t-sm bg-[var(--error)] pt-1">
              <Bookmark className="pointer-events-none absolute -bottom-1.5 h-3 w-3 fill-[var(--error)] text-[var(--error)]" />
              <span className="text-[11px] font-bold text-white">{completedChapters + 1}</span>
            </span>
          </Link>
```

`Link` is already imported at the top of the file.

- [ ] **Step 2: Delete the now-dead handler and import**

In the same file, delete the entire `handleCompleteChapter` function (around lines 86-95). Note it will already have been converted to `'error' in res` narrowing during Task 3's fix cascade — you are deleting it regardless, so its exact current shape does not matter. Then change the action import on line 11 from:

```tsx
import { completeChapter, shelveBook } from '@/app/(app)/home/actions'
```

to:

```tsx
import { shelveBook } from '@/app/(app)/home/actions'
```

Leave `isPending` / `startTransition` in place — `handleShelve` still uses them.

- [ ] **Step 3: Delete the unused wrapper action**

In `app/(app)/home/actions.ts`, delete lines 7-9:

```ts
export async function completeChapter(progressId: string, bookId: string, chapterNumber: number) {
  return logChapterCompletion(progressId, bookId, chapterNumber)
}
```

and delete the now-unused import on line 5:

```ts
import { logChapterCompletion } from '../library/actions'
```

`logChapterCompletion` itself stays — `app/(app)/library/notes/[bookId]/notes-client.tsx:101` still calls it.

- [ ] **Step 4: Verify nothing else referenced the deleted action**

Run: `grep -rn "completeChapter\b" app components lib --include="*.ts" --include="*.tsx"`
Expected: only hits for `completeChapterWithNotes` in `app/(app)/read/`. No hits for the bare `completeChapter`.

- [ ] **Step 5: Verify it compiles and lints**

Run: `npx tsc --noEmit` (see Global Constraints — the bar is no type errors in the files THIS task touched; pre-existing errors elsewhere are not yours)
Expected: PASS.

- [ ] **Step 6: Verify the whole flow end to end**

1. From `/home`, click "Complete Chapter". You navigate to `/read/<bookId>/chapter/<n>` — the chapter number in the bookmark badge matches the chapter in the page heading.
2. The counter on the home card did **not** tick up just from clicking.
3. Capture two notes, complete the chapter, choose "Keep it private".
4. Back on `/home`, the card now shows the next chapter and an advanced percentage.
5. For a group-scoped read, the URL carries `?group=`, and the completion writes `group_id` on the `chapter_completions` row.
6. Browser back from the chapter page returns cleanly to `/home`.
7. Check the whole flow at a narrow (mobile) width: the bottom nav does not overlap the composer or the Complete button.

- [ ] **Step 7: Commit**

```bash
git add components/currently-reading/currently-reading-card.tsx "app/(app)/home/actions.ts"
git commit -m "Route Complete Chapter to the new chapter completion page"
```
