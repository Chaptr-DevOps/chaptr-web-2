'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Loader2 } from 'lucide-react'
import { OnboardingShell } from '@/components/onboarding-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BookCover } from '@/components/book-cover'
import { registerBook } from '../actions'

interface SearchHit {
  title: string
  author: string
  pages: number | null
  cover: string | null
}

export default function BooksStep() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [saving, setSaving] = useState(false)

  // custom form
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
          query,
        )}&limit=8&fields=title,author_name,number_of_pages_median,cover_i`,
      )
      const json = await res.json()
      setResults(
        (json.docs ?? []).map((d: Record<string, unknown>) => ({
          title: d.title as string,
          author: (d.author_name as string[] | undefined)?.[0] ?? 'Unknown',
          pages: (d.number_of_pages_median as number) ?? null,
          cover: d.cover_i
            ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
            : null,
        })),
      )
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  async function selectBook(hit: SearchHit) {
    setSaving(true)
    const { id } = await registerBook({
      title: hit.title,
      author: hit.author,
      total_pages: hit.pages ?? undefined,
      cover_image_url: hit.cover ?? undefined,
    })
    if (id) {
      sessionStorage.setItem(
        'onboarding_book',
        JSON.stringify({ id, title: hit.title, chapters: null }),
      )
      router.push('/onboarding/chapter')
    } else {
      setSaving(false)
    }
  }

  async function saveCustom(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { id } = await registerBook({
      title: cTitle,
      author: cAuthor || undefined,
      total_pages: cPages ? Number(cPages) : undefined,
      total_chapters: cChapters ? Number(cChapters) : undefined,
    })
    if (id) {
      sessionStorage.setItem(
        'onboarding_book',
        JSON.stringify({
          id,
          title: cTitle,
          chapters: cChapters ? Number(cChapters) : null,
        }),
      )
      router.push('/onboarding/chapter')
    } else {
      setSaving(false)
    }
  }

  return (
    <OnboardingShell
      step="books"
      title="What are you reading?"
      subtitle="Search our catalog or add your own book."
    >
      {!showCustom ? (
        <>
          <form onSubmit={search} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or author"
              className="pl-11"
              autoFocus
            />
          </form>

          <div className="mt-4 flex flex-col gap-2">
            {searching && (
              <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)]">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {results.map((hit, i) => (
              <button
                key={i}
                type="button"
                disabled={saving}
                onClick={() => selectBook(hit)}
                className="flex items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-3 text-left transition-colors hover:border-primary/50 disabled:opacity-60"
              >
                <div className="w-10 shrink-0">
                  <BookCover
                    title={hit.title}
                    author={hit.author}
                    src={hit.cover}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--text-primary)]">
                    {hit.title}
                  </p>
                  <p className="truncate text-sm text-[var(--text-secondary)]">
                    {hit.author}
                    {hit.pages ? ` · ${hit.pages} pages` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="mt-4 inline-flex items-center gap-2 text-[15px] font-medium text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            Can&apos;t find it? Add a custom book
          </button>
        </>
      ) : (
        <form onSubmit={saveCustom} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="t">Title</Label>
            <Input
              id="t"
              required
              value={cTitle}
              onChange={(e) => setCTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="a">Author</Label>
            <Input
              id="a"
              value={cAuthor}
              onChange={(e) => setCAuthor(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p">Pages</Label>
              <Input
                id="p"
                type="number"
                value={cPages}
                onChange={(e) => setCPages(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c">Chapters</Label>
              <Input
                id="c"
                type="number"
                value={cChapters}
                onChange={(e) => setCChapters(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCustom(false)}
            >
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving...' : 'Add book'}
            </Button>
          </div>
        </form>
      )}
    </OnboardingShell>
  )
}
