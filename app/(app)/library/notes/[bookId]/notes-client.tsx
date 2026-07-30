'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronRight,
  Eye,
  EyeOff,
  Flame,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
  Trophy,
  Unlock,
  FileText,
} from 'lucide-react'
import { BookCover } from '@/components/book-cover'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { logChapterCompletion, saveNote, deleteNote, setBookShelf } from '../../actions'
import { SHELF_OPTIONS } from '@/lib/types'
import type { ShelfType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NotesClientProps {
  book: {
    id: string
    title: string
    author: string | null
    total_pages: number | null
    total_chapters: number | null
    cover_image_url: string | null
  }
  progress: {
    id: string
    current_chapter: number
    progress_percentage: number
    status: string
  } | null
  // The shelf this book is on, from user_library. Separate from progress.
  libraryItem: { id: string; shelf_type: ShelfType } | null
  completions: Array<{
    id: string
    chapter_number: number
    reflection_text: string | null
    completed_at: string
  }>
  notes: Array<{
    id: string
    chapter_number: number | null
    note_content: string | null
    is_private: boolean
    created_at: string
    updated_at: string
  }>
}

export function NotesClient({
  book,
  progress: initialProgress,
  libraryItem,
  completions,
  notes,
}: NotesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'log' | 'notes'>('log')

  // Chapter completion states
  const [chapterToLog, setChapterToLog] = useState(
    initialProgress ? Math.min(book.total_chapters ?? 100, initialProgress.current_chapter + 1) : 1
  )
  const [reflection, setReflection] = useState('')
  const [showCelebration, setShowCelebration] = useState(false)
  const [earnedXP, setEarnedXP] = useState(0)

  // Note editor states
  const [noteId, setNoteId] = useState<string | undefined>(undefined)
  const [noteContent, setNoteContent] = useState('')
  const [noteChapter, setNoteChapter] = useState<string>(
    initialProgress ? String(initialProgress.current_chapter) : ''
  )
  const [notePrivate, setNotePrivate] = useState(true)

  async function handleLogChapter(e: React.FormEvent) {
    e.preventDefault()
    if (!initialProgress) return

    startTransition(async () => {
      const res = await logChapterCompletion(
        initialProgress.id,
        book.id,
        chapterToLog,
        { reflectionText: reflection }
      )

      if ('error' in res) {
        alert(res.error)
      } else {
        // Award XP and show celebration
        setEarnedXP(50 + (reflection ? 25 : 0))
        setShowCelebration(true)
        setReflection('')
        setChapterToLog(Math.min(book.total_chapters ?? 100, chapterToLog + 1))
        router.refresh()
      }
    })
  }

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteContent.trim()) return

    startTransition(async () => {
      const res = await saveNote({
        id: noteId,
        bookId: book.id,
        chapterNumber: noteChapter ? Number(noteChapter) : null,
        content: noteContent,
        isPrivate: notePrivate,
      })

      if (res.error) {
        alert(res.error)
      } else {
        setNoteId(undefined)
        setNoteContent('')
        setNotePrivate(true)
        router.refresh()
      }
    })
  }

  async function handleDeleteNote(id: string) {
    if (!confirm('Are you sure you want to delete this note?')) return
    startTransition(async () => {
      const res = await deleteNote(id, book.id)
      if (res.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
    })
  }

  function startEditNote(note: typeof notes[0]) {
    setNoteId(note.id)
    setNoteContent(note.note_content ?? '')
    setNoteChapter(note.chapter_number ? String(note.chapter_number) : '')
    setNotePrivate(note.is_private)
    setActiveTab('notes')
  }

  // Quick shelf change. Keyed by book, so it also works for a book that is being
  // read but has never been filed on a shelf.
  async function handleShelfChange(newShelf: ShelfType) {
    startTransition(async () => {
      const res = await setBookShelf(book.id, newShelf)
      if (res.error) alert(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-6 px-5 md:px-8">
      {/* Header back button */}
      <div className="flex items-center gap-3">
        <Link href="/library" aria-label="Back to Library" className={buttonVariants({ variant: 'outline', size: 'icon' })}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        <span className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Book Details</span>
      </div>

      {/* Book details card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-28 shrink-0 mx-auto md:mx-0">
            <BookCover
              title={book.title}
              author={book.author}
              src={book.cover_image_url}
              className="shadow-md"
            />
          </div>
          <div className="flex-1 flex flex-col justify-between text-center md:text-left">
            <div className="space-y-1.5">
              <h2 className="font-serif text-[28px] font-bold tracking-tight text-[var(--text-primary)]">
                {book.title}
              </h2>
              <p className="text-base text-[var(--text-secondary)] font-medium">
                {book.author ?? 'Unknown Author'}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-[var(--text-tertiary)] pt-1">
                {book.total_pages && <span>{book.total_pages} Pages</span>}
                {book.total_chapters && <span>{book.total_chapters} Chapters</span>}
                {initialProgress && (
                  <span className="font-semibold uppercase text-primary tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
                    {initialProgress.status}
                  </span>
                )}
              </div>
            </div>

            {initialProgress && initialProgress.status === 'reading' && (
              <div className="mt-4 max-w-2xl space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[var(--text-secondary)]">
                    Progress: Chapter {initialProgress.current_chapter} of {book.total_chapters ?? 'unknown'}
                  </span>
                  <span className="font-bold text-primary">{Math.round(initialProgress.progress_percentage)}%</span>
                </div>
                <Progress value={initialProgress.progress_percentage} className="h-2" />
              </div>
            )}

            {/* Quick shelf changer. Shown even when the book is on no shelf yet. */}
            {(libraryItem || initialProgress) && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-4 pt-2">
                <span className="text-xs text-[var(--text-tertiary)] mr-2 font-semibold">Change Shelf:</span>
                {SHELF_OPTIONS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    disabled={t.key === libraryItem?.shelf_type}
                    onClick={() => handleShelfChange(t.key)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                      t.key === libraryItem?.shelf_type
                        ? 'bg-primary/10 border-primary/20 text-primary font-semibold'
                        : 'border-[var(--border-main)] hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)]'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Main Tabs (Log Progress / Personal Notes) */}
      <div className="flex border-b border-[var(--border-main)] gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('log')}
          className={cn(
            'px-4 py-2.5 text-sm font-semibold border-b-2 transition-all',
            activeTab === 'log'
              ? 'border-primary text-primary'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          )}
        >
          Track &amp; Progress
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={cn(
            'px-4 py-2.5 text-sm font-semibold border-b-2 transition-all',
            activeTab === 'notes'
              ? 'border-primary text-primary'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          )}
        >
          Personal Notes ({notes.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* TAB 1: LOG & CHAPTERS */}
        {activeTab === 'log' && (
          <>
            {/* Column 1: Log form */}
            <div className="md:col-span-2 space-y-6">
              {showCelebration && (
                <Card className="border-primary bg-primary/8 p-6 text-center animate-in fade-in zoom-in-95 duration-200">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary mb-3">
                    <Trophy className="h-7 w-7" />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-[var(--text-primary)] mb-1">
                    Chapter Logged!
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Congratulations! You earned <span className="font-bold text-primary">+{earnedXP} XP</span> and kept your reading streak alive.
                  </p>
                  <Button size="sm" onClick={() => setShowCelebration(false)}>
                    Awesome, keep reading
                  </Button>
                </Card>
              )}

              {initialProgress?.status === 'reading' && !showCelebration && (
                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Flame className="h-4.5 w-4.5" />
                    </span>
                    <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                      Log Chapter Completion
                    </h3>
                  </div>

                  <form onSubmit={handleLogChapter} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="chapter">Select completed chapter</Label>
                      <div className="flex items-center gap-4">
                        <input
                          id="chapter"
                          type="range"
                          min={1}
                          max={book.total_chapters ?? 100}
                          value={chapterToLog}
                          onChange={(e) => setChapterToLog(Number(e.target.value))}
                          className="flex-1 accent-primary h-2 bg-[var(--border-main)] rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="font-mono text-sm font-bold border border-[var(--border-main)] px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] min-w-[3.5rem] text-center">
                          {chapterToLog}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reflection">Reflections (Optional)</Label>
                      <Textarea
                        id="reflection"
                        rows={3}
                        placeholder="What happened in this chapter? Write down your thoughts, predictions or highlights..."
                        value={reflection}
                        onChange={(e) => setReflection(e.target.value)}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-full animate-spin" />
                      ) : (
                        'Log Chapter Complete'
                      )}
                    </Button>
                  </form>
                </Card>
              )}

              {/* Completions Feed */}
              <div className="space-y-3">
                <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                  Completed Chapters Log
                </h3>
                {completions.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No chapters completed yet. Log your first chapter above!</p>
                ) : (
                  <div className="space-y-3">
                    {completions.map((comp) => (
                      <Card key={comp.id} className="p-4 flex gap-4">
                        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/10 text-[var(--success)]">
                          <BookOpen className="h-4.5 w-4.5" />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-4">
                            <h4 className="font-semibold text-sm text-[var(--text-primary)]">
                              Chapter {comp.chapter_number} Completed
                            </h4>
                            <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(comp.completed_at).toLocaleDateString()}
                            </span>
                          </div>
                          {comp.reflection_text && (
                            <p className="text-sm text-[var(--text-secondary)] italic pt-1 bg-[var(--surface-elevated)]/50 p-2.5 rounded-lg border border-[var(--border-main)]/50 leading-relaxed">
                              &ldquo;{comp.reflection_text}&rdquo;
                            </p>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Side metadata / shortcuts */}
            <div className="space-y-6">
              <Card className="p-5 bg-[var(--surface-elevated)]/30">
                <h3 className="font-serif font-bold text-base text-[var(--text-primary)] mb-3">Reading Goal</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Log chapters regularly to maintain your daily streak and progress toward your goals. 
                </p>
              </Card>
            </div>
          </>
        )}

        {/* TAB 2: NOTES & NOTES EDITOR */}
        {activeTab === 'notes' && (
          <>
            {/* Column 1: Notes feed */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Personal Notes History
              </h3>
              {notes.length === 0 ? (
                <Card className="p-8 text-center border-dashed">
                  <FileText className="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-2" />
                  <p className="text-sm text-[var(--text-secondary)]">No notes saved yet. Create a note on the right!</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <Card key={note.id} className="p-4 space-y-3 relative group">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded text-primary">
                            {note.chapter_number ? `Chapter ${note.chapter_number}` : 'Book Note'}
                          </span>
                          {note.is_private ? (
                            <span className="inline-flex text-[11px] text-[var(--text-tertiary)] items-center gap-1">
                              <Lock className="h-3 w-3" /> Private
                            </span>
                          ) : (
                            <span className="inline-flex text-[11px] text-primary items-center gap-1">
                              <Unlock className="h-3 w-3" /> Public
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => startEditNote(note)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                        {note.note_content}
                      </div>

                      <div className="text-[11px] text-[var(--text-tertiary)] text-right">
                        Last updated {new Date(note.updated_at).toLocaleDateString()}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: Note Editor Form */}
            <div>
              <Card className="p-5 sticky top-6">
                <h3 className="font-serif font-bold text-base text-[var(--text-primary)] mb-3 flex items-center justify-between">
                  <span>{noteId ? 'Edit Note' : 'Add Personal Note'}</span>
                  {noteId && (
                    <button
                      type="button"
                      className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] font-semibold"
                      onClick={() => {
                        setNoteId(undefined)
                        setNoteContent('')
                        setNotePrivate(true)
                      }}
                    >
                      Clear / New
                    </button>
                  )}
                </h3>

                <form onSubmit={handleSaveNote} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="noteChapter">Associated Chapter (Optional)</Label>
                    <Input
                      id="noteChapter"
                      type="number"
                      placeholder="e.g. 3"
                      value={noteChapter}
                      onChange={(e) => setNoteChapter(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="noteContent">Note Content (Markdown supported)</Label>
                    <Textarea
                      id="noteContent"
                      rows={6}
                      required
                      placeholder="Write your note down here..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between border border-[var(--border-main)] rounded-lg p-2.5 bg-[var(--surface-elevated)]/40">
                    <div className="space-y-0.5">
                      <Label htmlFor="isPrivate" className="text-xs font-semibold">Private Note</Label>
                      <p className="text-[10px] text-[var(--text-secondary)]">Only visible to you.</p>
                    </div>
                    <Switch
                      id="isPrivate"
                      checked={notePrivate}
                      onCheckedChange={setNotePrivate}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1.5" />
                        <span>Save Note</span>
                      </>
                    )}
                  </Button>
                </form>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
