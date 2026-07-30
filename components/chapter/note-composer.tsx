'use client'

import { useRef, useState } from 'react'
import { ArrowUpCircle } from 'lucide-react'

export function NoteComposer({
  onSubmit,
  error,
}: {
  onSubmit: (content: string) => Promise<boolean>
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

  async function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    setValue('')
    requestAnimationFrame(() => {
      resize()
      textareaRef.current?.focus()
    })

    const ok = await onSubmit(trimmed)
    if (!ok) {
      // Put the text back so the reader can retry. Losing a captured thought is
      // the worst failure this page can have.
      setValue(trimmed)
      requestAnimationFrame(() => {
        resize()
        textareaRef.current?.focus()
      })
    }
  }

  return (
    <div>
      <div className="border-l border-[var(--border-main)] pl-4">
        <div className="flex items-start gap-3 py-2.5">
          <span
            aria-hidden
            className="mt-2 h-2 w-2 shrink-0 -translate-x-[calc(1rem+0.25rem+0.5px)] rounded-full border border-[var(--border-main)] bg-background"
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
