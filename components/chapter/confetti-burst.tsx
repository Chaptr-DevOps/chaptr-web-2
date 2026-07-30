'use client'

const PIECES = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i * 4 + 4) % 100}%`,
  delay: `${(i % 8) * 60}ms`,
  // NOTE: the raw token is --interactive-primary. There is no --primary custom
  // property; `bg-primary` is a Tailwind alias mapped in @theme inline, so
  // `var(--primary)` would resolve to nothing and this piece would be invisible.
  color: ['var(--success)', 'var(--interactive-primary)', 'var(--warning)', 'var(--error)'][i % 4],
  size: i % 3 === 0 ? 10 : 12,
}))

export function ConfettiBurst({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="chaptr-confetti absolute top-0 rounded-[2px]"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
          }}
        />
      ))}

      <style jsx>{`
        .chaptr-confetti {
          animation: chaptr-confetti-fall 2s ease-in forwards;
          opacity: 0;
        }
        @keyframes chaptr-confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(540deg);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .chaptr-confetti {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
