import { blockingReason, type Requirement } from '@/lib/blockingReason'

/**
 * The one way a disabled primary action explains itself (X-9).
 *
 * Renders nothing at all when the action can run, so this is never the
 * permanent help text of **X-5** — it appears only while something is actually
 * missing, and names all of it rather than the first thing.
 *
 * `role="status"` so the message is announced when it changes: a `disabled`
 * button is out of the tab order, so `aria-describedby` on the button would
 * never be read.
 */
export function BlockingReason({ checks, className = '' }: {
  checks: readonly Requirement[]
  className?: string
}) {
  const reason = blockingReason(checks)
  if (!reason) return null
  return (
    <p role="status" className={`text-xs text-[hsl(var(--muted-foreground))] ${className}`}>
      {reason}
    </p>
  )
}
