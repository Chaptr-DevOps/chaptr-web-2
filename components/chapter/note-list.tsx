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

  // Resync the draft from props only while NOT editing. A failed edit rolls the
  // note's content back, and that prop change must never overwrite keystrokes
  // the user is typing in a reopened editor.
  useEffect(() => {
    if (editing) return
    setDraft(note.content)
  }, [note.content, editing])

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
          aria-label="Edit note"
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
