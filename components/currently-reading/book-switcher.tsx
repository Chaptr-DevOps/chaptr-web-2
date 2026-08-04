'use client'

import { useCallback, useRef, useState } from 'react'
import { CurrentlyReadingCard, type CurrentlyReadingCardData } from './currently-reading-card'
import { DiscussionsPanel } from '@/components/discussions/discussions-panel'
import type { DiscussionWithUser } from '@/components/discussions/discussion-thread'
import { cn } from '@/lib/utils'

export interface BookSwitcherEntry extends CurrentlyReadingCardData {
  discussions: DiscussionWithUser[]
}

export function BookSwitcher({ cards }: { cards: BookSwitcherEntry[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const clamped = Math.min(index, cards.length - 1)
  const active = cards[clamped]

  // Derive the active card from scroll position rather than an assumed slide
  // width, so gaps/padding on the track can change without breaking the dots.
  const handleScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const slides = Array.from(track.children) as HTMLElement[]
    let nearest = 0
    let smallest = Infinity
    slides.forEach((slide, i) => {
      const distance = Math.abs(slide.offsetLeft - track.scrollLeft)
      if (distance < smallest) {
        smallest = distance
        nearest = i
      }
    })
    setIndex((prev) => (prev === nearest ? prev : nearest))
  }, [])

  const scrollTo = (i: number) => {
    const track = trackRef.current
    const slide = track?.children[i] as HTMLElement | undefined
    if (!track || !slide) return
    track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
  }

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => (
          <div key={card.progress.id} className="w-full shrink-0 snap-center">
            <CurrentlyReadingCard data={card} />
          </div>
        ))}
      </div>

      {cards.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {cards.map((c, i) => (
            <button
              key={c.progress.id}
              type="button"
              aria-label={`Switch to book ${i + 1}`}
              aria-current={i === clamped}
              onClick={() => scrollTo(i)}
              className={cn(
                'h-2 rounded-full transition-all',
                i === clamped ? 'w-4 bg-primary' : 'w-2 bg-[var(--border-main)]',
              )}
            />
          ))}
        </div>
      )}

      <div className="mt-8">
        <DiscussionsPanel
          discussions={active.discussions}
          bookId={active.progress.book_id}
          currentChapter={active.progress.current_chapter}
          groupId={active.progress.group_id}
          groupName={active.groupName}
        />
      </div>
    </div>
  )
}
