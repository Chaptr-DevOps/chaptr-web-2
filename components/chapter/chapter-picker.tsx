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
