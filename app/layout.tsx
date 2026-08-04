import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Crimson_Pro, Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

// Runs before first paint so the correct palette is applied with no flash.
// Keep the storage key in sync with components/theme-provider.tsx.
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('chaptr-theme')||'system';var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(d?'dark':'light');e.style.colorScheme=d?'dark':'light';}catch(e){}})()`

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const crimson = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-crimson',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Chaptr — Read together, one chapter at a time',
  description:
    'Track your reading, log chapter completions, join reading groups with live chat, and keep personal notes. Chaptr is your book club, reimagined.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F5EF' },
    { media: '(prefers-color-scheme: dark)', color: '#0C1014' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${crimson.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
