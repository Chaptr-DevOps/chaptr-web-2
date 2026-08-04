'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookCover } from '@/components/book-cover'
import { setGroupCurrentBook } from '@/app/(app)/groups/actions'

interface BookResult {
  title: string
  author: string
  cover: string | null
}

interface SetGroupBookModalProps {
  groupId: string
  /** Label for the trigger button. */
  label?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'default' | 'sm'
  className?: string
}

/**
 * Trigger + modal for picking the group's current book. Searches the Open
 * Library catalog; the selected result is registered in `books` (if new) and
 * set as `reading_groups.current_book_id` by `setGroupCurrentBook`.
 *
 * Render this only for the group's owner/admin — the underlying write is
 * restricted to the group creator by RLS.
 */
export function SetGroupBookModal({
  groupId,
  label = 'Select a book',
  variant = 'primary',
  size = 'sm',
  className,
}: SetGroupBookModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  function close() {
    setOpen(false)
    setQuery('')
    setResults([])
    setSearched(false)
    setError('')
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError('')
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=title,author_name,cover_i`,
      )
      const json = await res.json()
      setResults(
        (json.docs ?? []).map((d: any) => ({
          title: d.title,
          author: d.author_name?.[0] ?? 'Unknown author',
          cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
        })),
      )
    } catch {
      setResults([])
      setError('Could not reach the book catalog. Try again.')
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  function handleSelect(book: BookResult) {
    setError('')
    startTransition(async () => {
      const res = await setGroupCurrentBook(groupId, {
        title: book.title,
        author: book.author || null,
        coverImageUrl: book.cover,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      close()
      router.refresh()
    })
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <BookOpen className="mr-1.5 h-4 w-4" />
        {label}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-[var(--border-main)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                  Set the group book
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Search the catalog and pick what everyone reads next.
                </p>
              </div>
            </div>

            <form onSubmit={handleSearch} className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                autoFocus
                className="pl-10"
                placeholder="Search by title or author..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>

            <div className="-mx-1 mt-4 flex-1 space-y-2 overflow-y-auto px-1">
              {searching && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                </div>
              )}

              {!searching && searched && results.length === 0 && !error && (
                <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
                  No books found for “{query}”.
                </p>
              )}

              {!searching &&
                results.map((b, i) => (
                  <button
                    key={`${b.title}-${i}`}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSelect(b)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-3 text-left transition-colors hover:border-primary/30 disabled:opacity-60"
                  >
                    <div className="w-10 shrink-0">
                      <BookCover title={b.title} author={b.author} src={b.cover} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">
                        {b.title}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">{b.author}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary">Set</span>
                  </button>
                ))}
            </div>

            {error && <p className="mt-3 text-sm text-[var(--error)]">{error}</p>}

            <div className="mt-5 flex justify-end">
              <Button type="button" variant="outline" onClick={close} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
