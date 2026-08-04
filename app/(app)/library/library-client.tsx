'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  Trash2,
  BookOpen,
  FolderHeart,
  NotebookPen,
  ChevronDown,
  Loader2,
  Pencil,
} from 'lucide-react'
import { BookCover } from '@/components/book-cover'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  setBookShelf,
  removeBookFromLibrary,
  createShelf,
  updateShelf,
  deleteShelf,
  addBookToCustomShelf,
  removeBookFromCustomShelf,
} from './actions'
import { LIBRARY_TABS, SHELF_OPTIONS } from '@/lib/types'
import type {
  Book,
  CustomShelf,
  ShelfBookWithBook,
  ShelfType,
  UserLibraryItemWithBook,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type BookSummary = Pick<
  Book,
  'id' | 'title' | 'author' | 'total_pages' | 'total_chapters' | 'cover_image_url'
>

interface ReadingProgressRow {
  id: string
  user_id: string
  book_id: string
  group_id: string | null
  current_chapter: number
  progress_percentage: number
  status: string
  created_at: string
  book: BookSummary
}

// One card, whichever tab produced it. The "Reading" tab is built from
// reading_progress, so shelfType may be null — the book is being read without
// having been filed on a shelf.
interface LibraryCard {
  bookId: string
  book: BookSummary
  shelfType: ShelfType | null
  progress: ReadingProgressRow | null
}

export function LibraryClient({
  initialItems,
  initialProgress,
  initialShelves,
  initialShelfBooksByShelf,
}: {
  initialItems: UserLibraryItemWithBook[]
  initialProgress: ReadingProgressRow[]
  initialShelves: CustomShelf[]
  initialShelfBooksByShelf: Record<string, ShelfBookWithBook[]>
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>('reading')
  const [searchQuery, setSearchQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const [actioningId, setActioningId] = useState<string | null>(null)

  const [isShelfPending, startShelfTransition] = useTransition()
  const [shelfForm, setShelfForm] = useState<
    | null
    | { mode: 'create'; name: string; description: string; isPublic: boolean }
    | { mode: 'edit'; id: string; name: string; description: string; isPublic: boolean }
  >(null)

  // A custom-shelf tab is keyed as `shelf:<id>`, distinct from the fixed status keys
  const isShelfTab = activeTab.startsWith('shelf:')
  const activeShelfId = isShelfTab ? activeTab.slice('shelf:'.length) : null
  const activeShelf = activeShelfId
    ? initialShelves.find((s) => s.id === activeShelfId) ?? null
    : null

  // Lookups so either tab kind can fill in the half it doesn't own
  const progressByBookId = new Map(initialProgress.map((p) => [p.book_id, p]))
  const shelfByBookId = new Map(initialItems.map((item) => [item.book_id, item.shelf_type]))

  const matchesSearch = (book: BookSummary) =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (book.author?.toLowerCase() ?? '').includes(searchQuery.toLowerCase())

  // 'reading' comes from reading_progress; every other tab is a real shelf.
  const filteredItems: LibraryCard[] = isShelfTab
    ? []
    : activeTab === 'reading'
      ? initialProgress
          .filter((p) => p.status === 'reading' && p.book && matchesSearch(p.book))
          .map((p) => ({
            bookId: p.book_id,
            book: p.book,
            shelfType: shelfByBookId.get(p.book_id) ?? null,
            progress: p,
          }))
      : initialItems
          .filter((item) => item.shelf_type === activeTab && matchesSearch(item.book))
          .map((item) => ({
            bookId: item.book_id,
            book: item.book,
            shelfType: item.shelf_type,
            progress: progressByBookId.get(item.book_id) ?? null,
          }))

  const filteredShelfBooks =
    isShelfTab && activeShelfId
      ? (initialShelfBooksByShelf[activeShelfId] ?? []).filter((sb) => {
          return (
            sb.book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (sb.book.author?.toLowerCase() ?? '').includes(searchQuery.toLowerCase())
          )
        })
      : []

  async function handleShelfChange(bookId: string, newShelf: ShelfType) {
    setActioningId(bookId)
    startTransition(async () => {
      const res = await setBookShelf(bookId, newShelf)
      if (res.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
      setActioningId(null)
    })
  }

  async function handleRemove(bookId: string) {
    if (!confirm('Remove this book from your shelves? Your reading progress and notes will be kept.')) {
      return
    }
    setActioningId(bookId)
    startTransition(async () => {
      const res = await removeBookFromLibrary(bookId)
      if (res.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
      setActioningId(null)
    })
  }

  function handleToggleShelfBook(shelfId: string, bookId: string, isCurrentlyIn: boolean) {
    startShelfTransition(async () => {
      const res = isCurrentlyIn
        ? await removeBookFromCustomShelf(shelfId, bookId)
        : await addBookToCustomShelf(shelfId, bookId)
      if (res.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
    })
  }

  function handleRemoveFromShelf(shelfId: string, bookId: string, rowId: string) {
    setActioningId(rowId)
    startShelfTransition(async () => {
      const res = await removeBookFromCustomShelf(shelfId, bookId)
      if (res.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
      setActioningId(null)
    })
  }

  function openCreateShelfForm() {
    setShelfForm({ mode: 'create', name: '', description: '', isPublic: false })
  }

  function openEditShelfForm(shelf: CustomShelf) {
    setShelfForm({
      mode: 'edit',
      id: shelf.id,
      name: shelf.name,
      description: shelf.description ?? '',
      isPublic: shelf.is_public,
    })
  }

  function handleSubmitShelfForm(e: React.FormEvent) {
    e.preventDefault()
    if (!shelfForm || !shelfForm.name.trim()) return

    startShelfTransition(async () => {
      if (shelfForm.mode === 'create') {
        const res = await createShelf({
          name: shelfForm.name,
          description: shelfForm.description || undefined,
          isPublic: shelfForm.isPublic,
        })
        if (res.error || !res.shelf) {
          alert(res.error ?? 'Could not create collection')
          return
        }
        setActiveTab(`shelf:${res.shelf.id}`)
      } else {
        const res = await updateShelf(shelfForm.id, {
          name: shelfForm.name,
          description: shelfForm.description || null,
          is_public: shelfForm.isPublic,
        })
        if (res.error) {
          alert(res.error)
          return
        }
      }
      setShelfForm(null)
      router.refresh()
    })
  }

  function handleDeleteShelf(shelfId: string) {
    if (
      !confirm(
        'Delete this collection? Books stay in your library — only the collection itself is removed.'
      )
    ) {
      return
    }
    startShelfTransition(async () => {
      const res = await deleteShelf(shelfId)
      if (res.error) {
        alert(res.error)
        return
      }
      setActiveTab('tbr')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6 px-5 md:px-8">
      {/* Tabs and Actions bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-main)] pb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {LIBRARY_TABS.map((tab) => {
            const count =
              tab.key === 'reading'
                ? initialProgress.filter((p) => p.status === 'reading').length
                : initialItems.filter((item) => item.shelf_type === tab.key).length
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'relative px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap rounded-lg',
                  activeTab === tab.key
                    ? 'bg-primary/12 text-primary font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
                )}
              >
                {tab.label}
                <span className={cn(
                  'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                  activeTab === tab.key ? 'bg-primary text-[var(--interactive-primary-foreground)]' : 'bg-[var(--border-main)] text-[var(--text-secondary)]'
                )}>
                  {count}
                </span>
              </button>
            )
          })}

          {initialShelves.length > 0 && (
            <div className="mx-1 h-6 w-px bg-[var(--border-main)] self-center shrink-0" />
          )}

          {initialShelves.map((shelf) => {
            const tabKey = `shelf:${shelf.id}`
            const active = activeTab === tabKey
            return (
              <button
                key={shelf.id}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap rounded-lg',
                  active
                    ? 'bg-primary/12 text-primary font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
                )}
              >
                <FolderHeart className="h-3.5 w-3.5" />
                {shelf.name}
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full',
                  active ? 'bg-primary text-[var(--interactive-primary-foreground)]' : 'bg-[var(--border-main)] text-[var(--text-secondary)]'
                )}>
                  {shelf.book_count}
                </span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={openCreateShelfForm}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-primary hover:bg-[var(--surface-elevated)] rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            New Collection
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Filter current shelf..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-main)] bg-[var(--surface)] pl-9 pr-4 py-2 text-sm focus:border-primary/50 focus:outline-none text-[var(--text-primary)]"
          />
        </div>
      </div>

      {/* Create / edit collection form */}
      {shelfForm && (
        <Card className="p-5">
          <form onSubmit={handleSubmitShelfForm} className="space-y-4">
            <h3 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
              {shelfForm.mode === 'create' ? 'New collection' : 'Edit collection'}
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="shelf-name">Name *</Label>
              <Input
                id="shelf-name"
                required
                value={shelfForm.name}
                onChange={(e) => setShelfForm({ ...shelfForm, name: e.target.value })}
                placeholder="Favorites, 2026 Reread, Book Club..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shelf-description">Description</Label>
              <Input
                id="shelf-description"
                value={shelfForm.description}
                onChange={(e) => setShelfForm({ ...shelfForm, description: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={shelfForm.isPublic}
                onChange={(e) => setShelfForm({ ...shelfForm, isPublic: e.target.checked })}
                className="h-4 w-4 rounded border-[var(--border-main)]"
              />
              Make this collection public
            </label>
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={isShelfPending}>
                {isShelfPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                {shelfForm.mode === 'create' ? 'Create' : 'Save'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShelfForm(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Active collection info bar (name/description + edit/delete) */}
      {!shelfForm && isShelfTab && activeShelf && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-4">
          <div className="min-w-0">
            <p className="font-serif text-base font-semibold text-[var(--text-primary)] truncate">
              {activeShelf.name}
            </p>
            {activeShelf.description && (
              <p className="text-xs text-[var(--text-secondary)] truncate">{activeShelf.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openEditShelfForm(activeShelf)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-main)] bg-[var(--surface)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={() => handleDeleteShelf(activeShelf.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-main)] bg-[var(--surface)] text-xs text-[var(--text-secondary)] hover:text-[var(--error)] hover:border-[var(--error)]/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Grid of Books */}
      {isShelfTab ? (
        filteredShelfBooks.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-elevated)] text-[var(--text-tertiary)] mb-4">
              <FolderHeart className="h-6 w-6" />
            </div>
            <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] mb-1">
              {searchQuery ? 'No matches' : 'This collection is empty'}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-xl mb-6">
              {searchQuery
                ? `No matching books in "${activeShelf?.name ?? 'this collection'}".`
                : 'Add books to this collection from any book card below, or from the Add Book page.'}
            </p>
            {!searchQuery && (
              <Button size="sm" onClick={() => router.push('/library/add')}>
                <Plus className="mr-1.5 h-4 w-4" /> Add a Book
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredShelfBooks.map((sb) => {
              const matched = progressByBookId.get(sb.book_id)
              // shelf_books has no id column — a row is (shelf_id, book_id)
              const rowKey = `${sb.shelf_id}:${sb.book_id}`
              const isCurrentActioning = actioningId === rowKey && isShelfPending
              return (
                <Card
                  key={rowKey}
                  className={cn(
                    'flex flex-col overflow-hidden transition-all duration-200 border-[var(--border-main)] hover:shadow-md hover:border-primary/30',
                    isCurrentActioning && 'opacity-65 pointer-events-none'
                  )}
                >
                  <div className="flex gap-4 p-4 flex-1">
                    <div className="w-20 shrink-0">
                      <BookCover
                        title={sb.book.title}
                        author={sb.book.author}
                        src={sb.book.cover_image_url}
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 justify-between">
                      <div>
                        <h4 className="font-serif font-semibold text-lg text-[var(--text-primary)] leading-snug line-clamp-2">
                          {sb.book.title}
                        </h4>
                        <p className="text-sm text-[var(--text-secondary)] truncate">
                          {sb.book.author ?? 'Unknown Author'}
                        </p>
                      </div>

                      {matched ? (
                        matched.status === 'reading' ? (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                              <span>Chapter {matched.current_chapter}</span>
                              <span>{Math.round(matched.progress_percentage)}%</span>
                            </div>
                            <Progress value={matched.progress_percentage} className="h-1.5" />
                          </div>
                        ) : (
                          <span
                            className={cn(
                              'inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full w-max mt-2',
                              matched.status === 'finished' && 'text-[var(--success)] bg-[var(--success)]/10',
                              matched.status === 'tbr' && 'text-primary bg-primary/10',
                              matched.status === 'dnf' && 'text-[var(--text-tertiary)] bg-[var(--border-main)]'
                            )}
                          >
                            {matched.status === 'finished'
                              ? 'Finished'
                              : matched.status === 'tbr'
                              ? 'Want to Read'
                              : 'Did Not Finish'}
                          </span>
                        )
                      ) : (
                        <span className="inline-flex text-[11px] font-semibold text-[var(--text-tertiary)] bg-[var(--border-main)] px-2 py-0.5 rounded-full w-max mt-2">
                          Not tracked yet
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border-main)] bg-[var(--surface-elevated)]/40 px-3 py-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleRemoveFromShelf(sb.shelf_id, sb.book_id, rowKey)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--error)] hover:border-[var(--error)]/30 transition-colors"
                    >
                      {isCurrentActioning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove from collection
                    </button>

                    <Link
                      href={`/library/notes/${sb.book_id}`}
                      className="inline-flex items-center gap-1.5 font-medium text-primary hover:text-primary-dark transition-colors px-2.5 py-1.5 rounded-lg hover:bg-primary/5"
                    >
                      <NotebookPen className="h-3.5 w-3.5" />
                      <span>Notes &amp; Progress</span>
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      ) : filteredItems.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-elevated)] text-[var(--text-tertiary)] mb-4">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] mb-1">
            No books found
          </h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-xl mb-6">
            {searchQuery
              ? `No matching books in "${LIBRARY_TABS.find((t) => t.key === activeTab)?.label}".`
              : activeTab === 'reading'
                ? "You're not reading anything right now. Start a book to see it here."
                : `Your "${LIBRARY_TABS.find((t) => t.key === activeTab)?.label}" shelf is empty. Add books to start tracking.`}
          </p>
          {!searchQuery && (
            <Button size="sm" onClick={() => router.push('/library/add')}>
              <Plus className="mr-1.5 h-4 w-4" /> Add a Book
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isCurrentActioning = actioningId === item.bookId && isPending
            const itemProgress = item.progress
            return (
              <Card
                key={item.bookId}
                className={cn(
                  'flex flex-col overflow-hidden transition-all duration-200 border-[var(--border-main)] hover:shadow-md hover:border-primary/30',
                  isCurrentActioning && 'opacity-65 pointer-events-none'
                )}
              >
                {/* Book Details Container */}
                <div className="flex gap-4 p-4 flex-1">
                  <div className="w-20 shrink-0">
                    <BookCover
                      title={item.book.title}
                      author={item.book.author}
                      src={item.book.cover_image_url}
                    />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 justify-between">
                    <div>
                      <h4 className="font-serif font-semibold text-lg text-[var(--text-primary)] leading-snug line-clamp-2">
                        {item.book.title}
                      </h4>
                      <p className="text-sm text-[var(--text-secondary)] truncate">
                        {item.book.author ?? 'Unknown Author'}
                      </p>
                    </div>

                    {/* Progress bar whenever the book is actually being tracked */}
                    {itemProgress && itemProgress.status === 'reading' && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                          <span>Chapter {itemProgress.current_chapter}</span>
                          <span>{Math.round(itemProgress.progress_percentage)}%</span>
                        </div>
                        <Progress value={itemProgress.progress_percentage} className="h-1.5" />
                      </div>
                    )}

                    {/* Shelf badge. Absent on a book that is being read but has
                        not been filed on any shelf. */}
                    {item.shelfType === 'completed' && (
                      <span className="inline-flex text-[11px] font-semibold text-[var(--success)] bg-[var(--success)]/10 px-2 py-0.5 rounded-full w-max mt-2">
                        Finished
                      </span>
                    )}
                    {item.shelfType === 'tbr' && (
                      <span className="inline-flex text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full w-max mt-2">
                        Want to Read
                      </span>
                    )}
                    {item.shelfType === 'shelved' && (
                      <span className="inline-flex text-[11px] font-semibold text-[var(--text-tertiary)] bg-[var(--border-main)] px-2 py-0.5 rounded-full w-max mt-2">
                        Shelved
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-[var(--border-main)] bg-[var(--surface-elevated)]/40 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    {/* Shelf quick switcher dropdown */}
                    <div className="relative group">
                      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <span>Shelf</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <div className="absolute left-0 bottom-full mb-1 z-50 hidden group-hover:block w-36 rounded-xl border border-[var(--border-main)] bg-[var(--surface)] shadow-lg py-1">
                        {SHELF_OPTIONS.map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            disabled={t.key === item.shelfType}
                            onClick={() => handleShelfChange(item.bookId, t.key)}
                            className={cn(
                              'w-full text-left px-3 py-2 text-xs hover:bg-[var(--surface-elevated)] transition-colors',
                              t.key === item.shelfType ? 'text-primary font-semibold pointer-events-none bg-primary/5' : 'text-[var(--text-secondary)]'
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Nothing to remove when the book is only being read and
                        has never been filed on a shelf. */}
                    {item.shelfType && (
                      <button
                        type="button"
                        onClick={() => handleRemove(item.bookId)}
                        className="inline-flex items-center justify-center p-2 rounded-lg border border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--error)] hover:border-[var(--error)]/30 transition-colors"
                        title="Remove from shelves"
                      >
                        {isCurrentActioning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}

                    {/* Collections (custom shelves) quick toggle */}
                    <div className="relative group">
                      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <FolderHeart className="h-3 w-3" />
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <div className="absolute left-0 bottom-full mb-1 z-50 hidden group-hover:block w-48 rounded-xl border border-[var(--border-main)] bg-[var(--surface)] shadow-lg py-1">
                        {initialShelves.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                            No collections yet
                          </p>
                        ) : (
                          initialShelves.map((shelf) => {
                            const inShelf = (initialShelfBooksByShelf[shelf.id] ?? []).some(
                              (sb) => sb.book_id === item.bookId
                            )
                            return (
                              <button
                                key={shelf.id}
                                type="button"
                                onClick={() => handleToggleShelfBook(shelf.id, item.bookId, inShelf)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] transition-colors"
                              >
                                <span className="truncate">{shelf.name}</span>
                                {inShelf && (
                                  <span className="text-primary text-[10px] font-semibold shrink-0">
                                    Added
                                  </span>
                                )}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/library/notes/${item.book.id}`}
                    className="inline-flex items-center gap-1.5 font-medium text-primary hover:text-primary-dark transition-colors px-2.5 py-1.5 rounded-lg hover:bg-primary/5"
                  >
                    <NotebookPen className="h-3.5 w-3.5" />
                    <span>Notes &amp; Progress</span>
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}