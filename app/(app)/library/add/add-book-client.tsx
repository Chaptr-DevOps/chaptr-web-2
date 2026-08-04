'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus, ArrowLeft, Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { BookCover } from '@/components/book-cover'
import { addBookToShelf, addBookToCustomShelf } from '../actions'
import { LIBRARY_TABS } from '@/lib/types'
import type { CustomShelf, ShelfType } from '@/lib/types'

interface SearchHit {
  title: string
  author: string
  pages: number | null
  cover: string | null
}

export function AddBookClient({ initialShelves }: { initialShelves: CustomShelf[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedShelf, setSelectedShelf] = useState<ShelfType>('tbr')
  const [selectedShelfIds, setSelectedShelfIds] = useState<string[]>([])

  function toggleShelfSelection(id: string) {
    setSelectedShelfIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  // Custom Book state
  const [cTitle, setCTitle] = useState('')
  const [cAuthor, setCAuthor] = useState('')
  const [cPages, setCPages] = useState('')
  const [cChapters, setCChapters] = useState('')

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(
          query
        )}&limit=8&fields=title,author_name,number_of_pages_median,cover_i`
      )
      const json = await res.json()
      setResults(
        (json.docs ?? []).map((d: Record<string, any>) => ({
          title: d.title,
          author: (d.author_name as string[])?.[0] ?? 'Unknown Author',
          pages: d.number_of_pages_median ?? null,
          cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
        }))
      )
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function handleSelectBook(hit: SearchHit) {
    startTransition(async () => {
      const res = await addBookToShelf(
        {
          title: hit.title,
          author: hit.author,
          total_pages: hit.pages ?? undefined,
          cover_image_url: hit.cover ?? undefined,
          total_chapters: hit.pages ? Math.max(1, Math.ceil(hit.pages / 20)) : 10, // heuristic: 20 pages/chapter
        },
        selectedShelf
      )

      if (res.error) {
        alert(res.error)
      } else {
        if (selectedShelfIds.length > 0 && res.bookId) {
          await Promise.all(
            selectedShelfIds.map((shelfId) => addBookToCustomShelf(shelfId, res.bookId!))
          )
        }
        router.push(selectedShelf === 'reading' ? `/library/notes/${res.bookId}` : '/library')
        router.refresh()
      }
    })
  }

  function handleSaveCustom(e: React.FormEvent) {
    e.preventDefault()
    if (!cTitle.trim()) return

    startTransition(async () => {
      const res = await addBookToShelf(
        {
          title: cTitle,
          author: cAuthor || undefined,
          total_pages: cPages ? Number(cPages) : undefined,
          total_chapters: cChapters ? Number(cChapters) : undefined,
        },
        selectedShelf
      )

      if (res.error) {
        alert(res.error)
      } else {
        if (selectedShelfIds.length > 0 && res.bookId) {
          await Promise.all(
            selectedShelfIds.map((shelfId) => addBookToCustomShelf(shelfId, res.bookId!))
          )
        }
        router.push(selectedShelf === 'reading' ? `/library/notes/${res.bookId}` : '/library')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6 px-5 md:px-8">
      <div className="flex items-center gap-3">
        <Link href="/library" aria-label="Back to Library" className={buttonVariants({ variant: 'outline', size: 'icon' })}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        <h2 className="font-serif text-[22px] tracking-[-0.3px] text-[var(--text-primary)]">
          {showCustom ? 'Add custom book' : 'Add book to your shelves'}
        </h2>
      </div>

      {/* Select shelf first */}
      <div className="rounded-xl border border-[var(--border-main)] p-4 bg-[var(--surface)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <label className="text-sm font-semibold text-[var(--text-primary)]">Target Shelf</label>
          <p className="text-xs text-[var(--text-secondary)]">Where should this book be added?</p>
        </div>
        <div className="flex gap-2">
          {LIBRARY_TABS.map((shelf) => (
            <button
              key={shelf.key}
              type="button"
              onClick={() => setSelectedShelf(shelf.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${
                selectedShelf === shelf.key
                  ? 'bg-primary border-primary text-[var(--interactive-primary-foreground)]'
                  : 'bg-[var(--surface-elevated)] border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {shelf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Optional: file this book under one or more custom collections too */}
      {initialShelves.length > 0 && (
        <div className="rounded-xl border border-[var(--border-main)] p-4 bg-[var(--surface)] space-y-3">
          <div>
            <label className="text-sm font-semibold text-[var(--text-primary)]">Add to Collections</label>
            <p className="text-xs text-[var(--text-secondary)]">
              Optional — also file this book under any of your collections.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {initialShelves.map((shelf) => {
              const selected = selectedShelfIds.includes(shelf.id)
              return (
                <button
                  key={shelf.id}
                  type="button"
                  onClick={() => toggleShelfSelection(shelf.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    selected
                      ? 'bg-primary border-primary text-[var(--interactive-primary-foreground)]'
                      : 'bg-[var(--surface-elevated)] border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {shelf.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!showCustom ? (
        <>
          <form onSubmit={search} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search OpenLibrary catalog..."
              className="w-full rounded-xl border border-[var(--border-main)] bg-[var(--surface)] pl-11 pr-4 py-3 text-sm focus:border-primary/50 focus:outline-none text-[var(--text-primary)]"
              autoFocus
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              disabled={searching}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </form>

          {/* Results List */}
          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Search Results</p>
              <div className="grid gap-3">
                {results.map((hit, idx) => (
                  <Card key={idx} className="flex gap-4 p-3 hover:border-primary/30 transition-colors">
                    <div className="w-14 shrink-0">
                      <BookCover title={hit.title} author={hit.author} src={hit.cover} />
                    </div>
                    <div className="flex flex-1 flex-col justify-between py-1 min-w-0">
                      <div>
                        <h4 className="font-serif font-semibold text-base text-[var(--text-primary)] line-clamp-1">
                          {hit.title}
                        </h4>
                        <p className="text-sm text-[var(--text-secondary)] truncate">
                          {hit.author}
                        </p>
                        {hit.pages && (
                          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                            ~{hit.pages} pages
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-max mt-2"
                        disabled={isPending}
                        onClick={() => handleSelectBook(hit)}
                      >
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Add to Shelf
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="text-center py-6">
            <p className="text-sm text-[var(--text-secondary)] mb-3">Can't find your book?</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowCustom(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Register custom book manually
            </Button>
          </div>
        </>
      ) : (
        <Card className="p-6">
          <form onSubmit={handleSaveCustom} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Book Title *</Label>
              <Input
                id="title"
                required
                value={cTitle}
                onChange={(e) => setCTitle(e.target.value)}
                placeholder="The Odyssey"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="author">Author Name</Label>
              <Input
                id="author"
                value={cAuthor}
                onChange={(e) => setCAuthor(e.target.value)}
                placeholder="Homer"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pages">Total Pages</Label>
                <Input
                  id="pages"
                  type="number"
                  min={1}
                  value={cPages}
                  onChange={(e) => setCPages(e.target.value)}
                  placeholder="350"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="chapters">Total Chapters</Label>
                <Input
                  id="chapters"
                  type="number"
                  min={1}
                  value={cChapters}
                  onChange={(e) => setCChapters(e.target.value)}
                  placeholder="24"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="h-4 w-4 mr-1.5" />
                )}
                Save Book
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCustom(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}