import { NextResponse } from 'next/server'

/**
 * Book search, proxied and cached.
 *
 * Four screens (onboarding, library/add, group tabs, set-group-book) each used
 * to call openlibrary.org straight from the browser. That API is slow and
 * frequently unwell — measured at 26s, then a 503, then a 40s timeout for the
 * same query — and every user paid that cost on every keystroke-batch, with no
 * shared cache and no timeout, so a hung request showed a spinner forever.
 *
 * Going through the server buys three things: Next's data cache means a repeat
 * query is served without touching OpenLibrary at all, the timeout is enforced
 * in one place, and swapping providers later is a change to this file rather
 * than to four components.
 *
 * Note this route is public — /api/* is exempt from the auth gate in
 * lib/supabase/proxy.ts. That's intentional (search runs during onboarding,
 * before a session exists) but it does mean the endpoint is an open proxy to
 * OpenLibrary; if that ever attracts abuse it needs rate limiting.
 */

/** Upstream is unreliable; fail visibly rather than hang the UI. */
const TIMEOUT_MS = 8000

/** Book metadata barely changes. A day is conservative. */
const CACHE_SECONDS = 60 * 60 * 24

export type BookSearchResult = {
  title: string
  author: string
  pages: number | null
  cover: string | null
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query) return NextResponse.json({ results: [] as BookSearchResult[] })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const upstream = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(
        query,
      )}&limit=8&fields=title,author_name,number_of_pages_median,cover_i`,
      { signal: controller.signal, next: { revalidate: CACHE_SECONDS } },
    )

    if (!upstream.ok) {
      // 503s from OpenLibrary are routine. Report it as an empty result with a
      // reason rather than a 500 — the caller shows "no results", not a crash.
      return NextResponse.json(
        { results: [] as BookSearchResult[], error: 'upstream_unavailable' },
        { status: 200 },
      )
    }

    const json = (await upstream.json()) as { docs?: Record<string, unknown>[] }
    const results: BookSearchResult[] = (json.docs ?? []).map((doc) => ({
      title: (doc.title as string) ?? 'Untitled',
      author: (doc.author_name as string[] | undefined)?.[0] ?? 'Unknown',
      pages: (doc.number_of_pages_median as number | undefined) ?? null,
      cover: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
    }))

    return NextResponse.json(
      { results },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
        },
      },
    )
  } catch {
    // AbortError (timeout) and network failures land here.
    return NextResponse.json(
      { results: [] as BookSearchResult[], error: 'timeout' },
      { status: 200 },
    )
  } finally {
    clearTimeout(timer)
  }
}
