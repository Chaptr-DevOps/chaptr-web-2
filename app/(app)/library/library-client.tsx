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
} from 'lucide-react'
import { BookCover } from '@/components/book-cover'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { updateBookShelf, removeBookFromLibrary } from './actions'
import { SHELF_TABS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ReadingProgressWithBook {
  id: string
  user_id: string
  book_id: string
  group_id: string | null
  current_chapter: number
  progress_percentage: number
  status: string
  created_at: string
  book: {
    id: string
    title: string
    author: string | null
    total_pages: number | null
    total_chapters: number | null
    cover_image_url: string | null
  }
}

export function LibraryClient({ initialItems }: { initialItems: ReadingProgressWithBook[] }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>('reading')
  const [searchQuery, setSearchQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const [actioningId, setActioningId] = useState<string | null>(null)

  // Filter items based on active tab and search query
  const filteredItems = initialItems.filter((item) => {
    const matchesTab = item.status === activeTab
    const matchesSearch =
      item.book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.book.author?.toLowerCase() ?? '').includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  async function handleShelfChange(progressId: string, newStatus: string) {
    setActioningId(progressId)
    startTransition(async () => {
      const res = await updateBookShelf(progressId, newStatus)
      if (res.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
      setActioningId(null)
    })
  }

  async function handleRemove(progressId: string) {
    if (!confirm('Are you sure you want to remove this book from your library? Your progress and history will be deleted.')) {
      return
    }
    setActioningId(progressId)
    startTransition(async () => {
      const res = await removeBookFromLibrary(progressId)
      if (res.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
      setActioningId(null)
    })
  }

  return (
    <div className="space-y-6 px-5 md:px-8">
      {/* Tabs and Actions bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-main)] pb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {SHELF_TABS.map((tab) => {
            const count = initialItems.filter((item) => item.status === tab.key).length
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

      {/* Grid of Books */}
      {filteredItems.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-elevated)] text-[var(--text-tertiary)] mb-4">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] mb-1">
            No books found
          </h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">
            {searchQuery
              ? `No matching books on your "${SHELF_TABS.find((t) => t.key === activeTab)?.label}" shelf.`
              : `Your "${SHELF_TABS.find((t) => t.key === activeTab)?.label}" shelf is empty. Add books to start tracking.`}
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
            const isCurrentActioning = actioningId === item.id && isPending
            return (
              <Card
                key={item.id}
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

                    {/* Progress tracking for reading tab */}
                    {item.status === 'reading' && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                          <span>Chapter {item.current_chapter}</span>
                          <span>{Math.round(item.progress_percentage)}%</span>
                        </div>
                        <Progress value={item.progress_percentage} className="h-1.5" />
                      </div>
                    )}

                    {/* Stats for other tabs */}
                    {item.status === 'finished' && (
                      <span className="inline-flex text-[11px] font-semibold text-[var(--success)] bg-[var(--success)]/10 px-2 py-0.5 rounded-full w-max mt-2">
                        Finished
                      </span>
                    )}
                    {item.status === 'tbr' && (
                      <span className="inline-flex text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full w-max mt-2">
                        Want to Read
                      </span>
                    )}
                    {item.status === 'dnf' && (
                      <span className="inline-flex text-[11px] font-semibold text-[var(--text-tertiary)] bg-[var(--border-main)] px-2 py-0.5 rounded-full w-max mt-2">
                        Did Not Finish
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
                        {SHELF_TABS.map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            disabled={t.key === item.status}
                            onClick={() => handleShelfChange(item.id, t.key)}
                            className={cn(
                              'w-full text-left px-3 py-2 text-xs hover:bg-[var(--surface-elevated)] transition-colors',
                              t.key === item.status ? 'text-primary font-semibold pointer-events-none bg-primary/5' : 'text-[var(--text-secondary)]'
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="inline-flex items-center justify-center p-2 rounded-lg border border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--error)] hover:border-[var(--error)]/30 transition-colors"
                      title="Remove from library"
                    >
                      {isCurrentActioning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
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
