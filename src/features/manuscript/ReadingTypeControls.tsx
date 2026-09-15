import { Minus, Plus } from 'lucide-react'
import { useAppStore } from '@/store'
import { stepSize, TEXT_SIZES, type Leading } from '@/lib/readingType'
import { cn } from '@/lib/utils'

const LEADING_LABELS: { value: Leading; label: string }[] = [
  { value: 'snug', label: 'Snug' },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'airy', label: 'Airy' },
]

/**
 * How the book is set, where a reader can reach it while reading.
 *
 * In the header's actions slot, which reading mode had left empty: the author's
 * Export and Find & replace live there while drafting, and this is the reader's
 * equivalent — the one control a tool people read in for hours is expected to
 * have.
 *
 * Small buttons rather than a popover. A reader adjusting type is comparing one
 * setting against the page behind it, and a panel covering the page is the
 * wrong shape for that; these change the prose underneath as they are pressed.
 */
export function ReadingTypeControls() {
  const type = useAppStore((s) => s.readingType)
  const setType = useAppStore((s) => s.setReadingType)

  const atSmallest = type.size <= TEXT_SIZES[0]
  const atLargest = type.size >= TEXT_SIZES[TEXT_SIZES.length - 1]

  const btn = 'rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[hsl(var(--accent)/0.4)]'

  return (
    <div className="flex items-center gap-2" role="group" aria-label="How the book is set">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(btn, 'px-1.5')}
          aria-label="Smaller text"
          disabled={atSmallest}
          onClick={() => setType({ size: stepSize(type.size, -1) })}
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {/*
          The size is said, not just implied by two buttons. A reader who has
          pressed the larger button four times wants to know whether there is a
          fifth, and the disabled state alone is easy to miss.
        */}
        <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
          {type.size}px
        </span>
        <button
          type="button"
          className={cn(btn, 'px-1.5')}
          aria-label="Larger text"
          disabled={atLargest}
          onClick={() => setType({ size: stepSize(type.size, 1) })}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/*
        A toggle rather than a pair, because the alternative to a sans face is
        whatever face the world's theme chose — which has no fixed name to put
        on a button. `aria-pressed` carries the state that "Sans" alone cannot.
      */}
      <button
        type="button"
        className={cn(btn, type.face === 'sans' && 'bg-[hsl(var(--accent))]')}
        aria-pressed={type.face === 'sans'}
        onClick={() => setType({ face: type.face === 'sans' ? 'book' : 'sans' })}
      >
        Sans
      </button>

      <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="Line spacing">
        {LEADING_LABELS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={cn(btn, type.leading === value && 'bg-[hsl(var(--accent))]')}
            aria-pressed={type.leading === value}
            onClick={() => setType({ leading: value })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
