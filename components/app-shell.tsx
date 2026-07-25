'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Users,
  Library,
  Bell,
  User as UserIcon,
  BookOpen,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'

const NAV = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/groups', label: 'Groups', icon: Users },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/notifications', label: 'Alerts', icon: Bell },
  { href: '/profile', label: 'Profile', icon: UserIcon },
]

export function AppShell({
  profile,
  children,
}: {
  profile: UserProfile | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/signin')
    router.refresh()
  }

  return (
    <div className="flex min-h-svh w-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-fit shrink-0 flex-col border-r border-[var(--border-main)] px-4 py-6 md:flex">
        <Link href="/home" className="mb-8 flex items-center gap-2 px-2 whitespace-nowrap">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[var(--interactive-primary-foreground)]">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="font-serif text-2xl tracking-[-0.5px]">Chaptr</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors whitespace-nowrap',
                isActive(href)
                  ? 'bg-primary/12 text-primary'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]',
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl border border-[var(--border-main)] p-2">
          <Avatar
            src={profile?.avatar_url}
            name={profile?.display_name ?? profile?.username}
            size={36}
          />
          <div className="min-w-0 flex-1 whitespace-nowrap">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">
              {profile?.display_name ?? 'Reader'}
            </p>
            <p className="truncate text-xs text-[var(--text-tertiary)]">
              @{profile?.username ?? 'you'}
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--error)]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 pb-24 md:pb-8">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-main)] bg-[var(--surface)]/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-2 py-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium',
                isActive(href)
                  ? 'text-primary'
                  : 'text-[var(--text-tertiary)]',
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
