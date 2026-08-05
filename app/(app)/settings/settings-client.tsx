'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  BookOpen,
  Camera,
  Save,
  LogOut,
  Shield,
  ChevronRight,
  Check,
  Palette,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useTheme, type ThemeMode } from '@/components/theme-provider'
import { updateProfile, uploadAvatar } from './actions'
import { GENRES } from '@/lib/types'
import type { UserProfile } from '@/lib/types'

type Section = 'profile' | 'appearance' | 'account'

const THEME_OPTIONS: { value: ThemeMode; label: string; hint: string; icon: React.ElementType }[] = [
  { value: 'light', label: 'Light', hint: 'Warm paper', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Low light', icon: Moon },
  { value: 'system', label: 'System', hint: 'Match device', icon: Monitor },
]

export function SettingsClient({ profile }: { profile: UserProfile }) {
  const router = useRouter()
  const { theme, setTheme, mounted } = useTheme()
  const [section, setSection] = useState<Section>('profile')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Profile form state
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [username, setUsername] = useState(profile.username ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [selectedGenres, setSelectedGenres] = useState<string[]>(profile.preferred_genres ?? [])
  const [favoriteGenre, setFavoriteGenre] = useState(profile.favorite_genre ?? '')

  // Reading goals
  const [yearlyGoal, setYearlyGoal] = useState(String(profile.yearly_reading_goal ?? '10'))
  const [readingSpeed] = useState(String(profile.average_reading_speed ?? '40'))

  // Avatar upload
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(profile.avatar_url ?? null)

  function toggleGenre(g: string) {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    )
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    setAvatarUploading(true)
    const fd = new FormData()
    fd.append('avatar', file)
    const result = await uploadAvatar(fd)
    setAvatarUploading(false)
    if (result?.error) setMessage({ type: 'error', text: result.error })
    else setMessage({ type: 'success', text: 'Avatar updated!' })
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('display_name', displayName)
      fd.append('username', username)
      fd.append('bio', bio)
      fd.append('yearly_reading_goal', yearlyGoal)
      fd.append('average_reading_speed', readingSpeed)
      fd.append('favorite_genre', favoriteGenre)
      selectedGenres.forEach((g) => fd.append('preferred_genres', g))

      const result = await updateProfile(fd)
      if (result?.error) setMessage({ type: 'error', text: result.error })
      else setMessage({ type: 'success', text: 'Profile saved!' })
    })
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // A document navigation, not router.push() + router.refresh(): those two
    // race, and refresh() re-fetching the current route can discard the push.
    // Signing out also has to drop every cached authed payload the router is
    // holding, which only a real navigation guarantees.
    window.location.assign('/signin')
  }

  const SECTIONS: { key: Section; label: string; icon: React.ElementType }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'account', label: 'Account', icon: Shield },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="px-5 pt-8 pb-2 md:px-8">
        <h1 className="font-serif text-[34px] leading-10 tracking-[-0.7px] text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="mt-1 text-[15px] text-[var(--text-secondary)]">
          Manage your profile and preferences.
        </p>
      </div>

      {/* Section nav */}
      <div className="flex gap-1 border-b border-[var(--border-main)] px-5 md:px-8">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              section === key
                ? 'border-primary text-primary'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-6 px-5 py-6 md:px-8">
        {/* Success/error toast */}
        {message && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-[var(--success)]/12 text-[var(--success)]'
                : 'bg-[var(--error)]/12 text-[var(--error)]'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* PROFILE SECTION */}
        {section === 'profile' && (
          <div className="space-y-6">
            {/* Avatar */}
            <Card elevated className="p-5">
              <p className="mb-4 text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Photo
              </p>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar
                    src={previewUrl}
                    name={displayName || username}
                    size={64}
                  />
                  {avatarUploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}
                </div>
                <div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-main)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-elevated)]"
                  >
                    <Camera className="h-4 w-4" />
                    Change photo
                  </button>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">JPG, PNG up to 5MB</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
            </Card>

            {/* Basic info */}
            <Card elevated className="p-5">
              <p className="mb-4 text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Basic info
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                    Display name
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    className="w-full rounded-xl border border-[var(--border-main)] bg-[var(--surface)] px-4 py-2.5 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                      @
                    </span>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                      placeholder="username"
                      className="w-full rounded-xl border border-[var(--border-main)] bg-[var(--surface)] py-2.5 pl-8 pr-4 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell other readers about yourself…"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[var(--border-main)] bg-[var(--surface)] px-4 py-2.5 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </Card>

            {/* Genre preferences */}
            <Card elevated className="p-5">
              <p className="mb-4 text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Genre preferences
              </p>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => {
                  const active = selectedGenres.includes(g)
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-all ${
                        active
                          ? 'border-primary bg-primary text-[var(--interactive-primary-foreground)]'
                          : 'border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-primary/50'
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      {g}
                    </button>
                  )
                })}
              </div>
              {selectedGenres.length > 0 && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                    Favourite genre
                  </label>
                  <select
                    value={favoriteGenre}
                    onChange={(e) => setFavoriteGenre(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-main)] bg-[var(--surface)] px-4 py-2.5 text-[15px] text-[var(--text-primary)] focus:border-primary focus:outline-none"
                  >
                    <option value="">Select favourite…</option>
                    {selectedGenres.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </Card>

            {/* Yearly book goal */}
            <Card elevated className="p-5">
              <p className="mb-4 text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Yearly book goal
              </p>
              <div className="mb-5 flex flex-col items-center gap-1">
                <BookOpen className="h-5 w-5 text-primary" />
                <p className="font-serif text-3xl tracking-tight text-[var(--text-primary)]">
                  {yearlyGoal}
                  <span className="ml-1.5 text-sm font-sans font-normal text-[var(--text-tertiary)]">
                    books this year
                  </span>
                </p>
              </div>
              <input
                type="range"
                min={1}
                max={200}
                step={1}
                value={yearlyGoal}
                onChange={(e) => setYearlyGoal(e.target.value)}
                className="w-full accent-primary"
              />
              <div className="mt-1.5 flex justify-between text-xs text-[var(--text-tertiary)]">
                <span>1</span>
                <span>200</span>
              </div>
            </Card>

            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[15px] font-semibold text-[var(--interactive-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </button>
          </div>
        )}

        {/* APPEARANCE SECTION */}
        {section === 'appearance' && (
          <div className="space-y-4">
            <Card elevated className="p-5">
              <p className="mb-1 text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Theme
              </p>
              <p className="mb-4 text-sm text-[var(--text-tertiary)]">
                Chaptr matches your device by default. Pick a fixed theme to override it.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {THEME_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
                  const active = mounted && theme === value
                  return (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 transition-all ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-[var(--border-main)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-primary/50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">{hint}</span>
                    </button>
                  )
                })}
              </div>
            </Card>

            {/* Live preview of the palette, so the choice is visible immediately */}
            <Card elevated className="p-5">
              <p className="mb-4 text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Preview
              </p>
              <div className="rounded-xl border border-[var(--border-main)] bg-[var(--background)] p-4">
                <p className="text-cardtitle text-[var(--text-primary)]">The Song of Achilles</p>
                <p className="text-caption mt-0.5 text-[var(--text-tertiary)]">Madeline Miller</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[var(--success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--success)]">
                    Reading
                  </span>
                  <span className="rounded-full bg-[var(--warning-bg)] px-2.5 py-1 text-xs font-medium text-[var(--warning)]">
                    Due soon
                  </span>
                  <span className="rounded-full bg-[var(--error-bg)] px-2.5 py-1 text-xs font-medium text-[var(--error)]">
                    Overdue
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--border-main)]">
                  <div className="h-full w-2/3 rounded-full bg-primary" />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ACCOUNT SECTION */}
        {section === 'account' && (
          <div className="space-y-4">
            <Card elevated className="divide-y divide-[var(--border-main)] overflow-hidden p-0">
              {profile.is_admin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[var(--surface-elevated)]"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Admin dashboard</p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        Moderation and platform management
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
                </button>
              )}
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">Email</p>
                <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
                  Managed by Supabase Auth
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">Account status</p>
                <span className="mt-1 inline-flex items-center rounded-full bg-[var(--success)]/12 px-2.5 py-0.5 text-xs font-medium text-[var(--success)] capitalize">
                  {profile.status}
                </span>
              </div>
            </Card>

            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/8 py-3 text-[15px] font-semibold text-[var(--error)] transition-opacity hover:opacity-80"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}