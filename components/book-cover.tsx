import { cn } from '@/lib/utils'

// Deterministic muted tint from a string so cover placeholders stay stable.
function tint(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}

export function BookCover({
  title,
  author,
  src,
  className,
}: {
  title: string
  author?: string | null
  src?: string | null
  className?: string
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src || '/placeholder.svg'}
        alt={`Cover of ${title}`}
        className={cn(
          'aspect-[2/3] w-full rounded-lg object-cover',
          className,
        )}
      />
    )
  }
  const h = tint(title)
  return (
    <div
      className={cn(
        'flex aspect-[2/3] w-full flex-col justify-between rounded-lg border border-black/10 p-3 text-left',
        className,
      )}
      style={{
        backgroundColor: `oklch(0.55 0.06 ${h})`,
        color: 'white',
      }}
    >
      <span className="font-serif text-[15px] leading-tight tracking-[-0.2px] line-clamp-4">
        {title}
      </span>
      {author && (
        <span className="text-[11px] font-medium opacity-80 line-clamp-1">
          {author}
        </span>
      )}
    </div>
  )
}
