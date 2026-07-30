'use client'

import { useEffect, useRef } from 'react'

/**
 * Escape-to-close plus focus-into-dialog for the chapter page's modals.
 * Mirrors the Escape handling already used by chapter-picker.tsx.
 *
 * Call this ABOVE any `if (!open) return null` early return — hooks must run
 * unconditionally. It self-guards on `open`, so that is safe.
 */
export function useModalDismiss(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    // Move focus into the dialog so assistive tech announces entry, and so Tab
    // starts inside the modal rather than in the page behind the overlay.
    dialogRef.current?.focus()
  }, [open])

  return dialogRef
}
