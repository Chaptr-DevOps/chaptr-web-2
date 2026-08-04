'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageIcon, Loader2, Trash2, Upload, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { setGroupBanner, removeGroupBanner } from './banner-actions'

/** Mirrors the group-banners bucket config (5 MB, jpeg/png/webp). */
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

interface BannerCardProps {
  groupId: string
  bannerUrl: string | null
  /** Only the group creator may change the banner — matches mobile and the storage policies. */
  canEdit: boolean
}

export function BannerCard({ groupId, bannerUrl, canEdit }: BannerCardProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const clearSelection = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFile(null)
  }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    // Reset so re-picking the same file still fires onChange.
    e.target.value = ''
    if (!picked) return

    setError('')
    if (!ACCEPTED.includes(picked.type)) {
      setError('Banner must be a JPG, PNG or WebP image.')
      return
    }
    if (picked.size > MAX_BYTES) {
      setError('Banner must be 5 MB or smaller.')
      return
    }

    if (preview) URL.revokeObjectURL(preview)
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
  }

  const handleSave = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const supabase = createClient()
      const path = `${groupId}/${Date.now()}.${EXT[file.type]}`
      const { error: uploadError } = await supabase.storage
        .from('group-banners')
        .upload(path, file, { contentType: file.type, upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      const { data } = supabase.storage.from('group-banners').getPublicUrl(path)
      const result = await setGroupBanner(groupId, data.publicUrl)
      if (result?.error) throw new Error(result.error)

      clearSelection()
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to upload banner image')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove the banner image for this group?')) return
    setBusy(true)
    setError('')
    try {
      const result = await removeGroupBanner(groupId)
      if (result?.error) throw new Error(result.error)
      clearSelection()
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to remove banner image')
    } finally {
      setBusy(false)
    }
  }

  const shown = preview ?? bannerUrl

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-primary" />
        <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">Banner Image</h3>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-main)] bg-[var(--surface-elevated)]">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Group banner" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--text-tertiary)]">
            <ImageIcon className="h-8 w-8" />
            <p className="text-sm">No banner image yet</p>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        Shown at 16:9 across the app — anything outside that crop is trimmed. JPG, PNG or WebP, up
        to 5 MB.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canEdit ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={handleSelect}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            {preview ? (
              <>
                <Button onClick={handleSave} disabled={busy}>
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Save Banner
                </Button>
                <Button variant="outline" onClick={clearSelection} disabled={busy}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
                <Upload className="mr-2 h-4 w-4" />
                {bannerUrl ? 'Change Banner' : 'Upload Banner'}
              </Button>
            )}
            {bannerUrl && !preview && (
              <Button
                variant="outline"
                onClick={handleRemove}
                disabled={busy}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-[var(--text-tertiary)]">
          Only the group creator can change the banner image.
        </p>
      )}
    </Card>
  )
}
