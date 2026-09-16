import { History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGate } from '@/db/hooks/ReadingGateContext'

/**
 * Marks state that was *carried forward* from an earlier scene rather than
 * recorded at the active moment. A snapshot is inherited when its own eventId
 * differs from the active event cursor.
 *
 * Echoes the dashed-edge convention the relationship graph already uses for
 * inherited relationships, so "this is assumed, not authored here" reads
 * consistently across the app.
 *
 * **Not shown while reading.** "No change recorded in the active scene" is a
 * fact about where to go and edit, which is a question a reader does not have.
 * It is also on nearly every card they see, because nothing is copied forward
 * when a scene is created and a snapshot exists only where somebody wrote one —
 * so a blind reader run met it everywhere and reported not knowing what it
 * meant. The decision is here rather than at the three call sites so that none
 * of them can forget it; outside a world the gate is open, so a badge drawn
 * somewhere without a provider behaves as it always did.
 */
export function InheritedBadge({ className, label = 'carried forward' }: { className?: string; label?: string }) {
  const gate = useGate()
  if (gate.active) return null
  return (
    <span
      title="Carried forward from an earlier scene — no change recorded in the active scene."
      className={cn(
        'inline-flex items-center gap-1 rounded border border-dashed border-[hsl(var(--border))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]',
        className
      )}
    >
      <History className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}
