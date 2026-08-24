import { History } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Marks state that was *carried forward* from an earlier scene rather than
 * recorded at the active moment. A snapshot is inherited when its own eventId
 * differs from the active event cursor.
 *
 * Echoes the dashed-edge convention the relationship graph already uses for
 * inherited relationships, so "this is assumed, not authored here" reads
 * consistently across the app.
 */
export function InheritedBadge({ className, label = 'carried forward' }: { className?: string; label?: string }) {
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
