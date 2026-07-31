import { BookOpen } from 'lucide-react'
import type { ReadingGate } from '@/db/hooks/useReading'

/**
 * Says that a list is short on purpose.
 *
 * Without this, gating is indistinguishable from missing data — a reader who
 * knows a character has appeared would reasonably conclude the world was badly
 * built rather than that they had set the cursor early. Naming the count and
 * the chapter makes the omission legible and, crucially, reversible: the fix is
 * to move the cursor, which the note points at.
 */
export function SpoilerNote({
  gate,
  hidden,
  noun,
}: {
  gate: ReadingGate
  hidden: number
  noun: string
}) {
  if (!gate.active || hidden === 0) return null

  return (
    <p
      className="mb-3 flex items-start gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]"
      role="note"
    >
      <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Reading mode — {hidden} {hidden === 1 ? noun.replace(/s$/, '') : noun} not yet met
        {gate.chapterNumber !== null ? ` by chapter ${gate.chapterNumber}` : ''} are hidden.
        Move the chapter cursor forward to reveal them.
      </span>
    </p>
  )
}
