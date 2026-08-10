import type { LucideIcon } from 'lucide-react'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * The one shape an empty section takes (X-4).
 *
 * Empty states were three different things at once: some excellent — a heading,
 * a sentence saying what the screen is for, and a control routing to whatever
 * has to exist first — some an italic grey sentence sitting where a control
 * should be, and some simply blank.
 *
 * The rule, in order of preference:
 *
 *  1. **Offer the act.** If the thing can be made from here, put the control in
 *     the empty state. The Arc grid and the Calendar (**CAL-1**) are the model.
 *  2. **Route to the prerequisite.** If it cannot — a calendar has to exist
 *     before a birth date can — name the screen *and go there*. Copy that names
 *     a screen without linking to it is its own finding (**LP-3**).
 *  3. **Say nothing.** If the control that fills the section is already sitting
 *     next to it, a sentence announcing the absence is noise, not help — the
 *     "+ Add character…" picker below an empty cast list already says both that
 *     it is empty and what to do.
 *
 * A bare value that happens to be unset — "No description." — is none of these.
 * It is a field reading empty, not a section with nothing to do, and it is left
 * alone.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  // As with PageHeader, the call to action on an empty section is an authoring
  // control — Add, New, Generate. A reader who lands on an empty section has
  // nothing to do there, so the prompt is dropped rather than offered.
  const gate = useGate()
  const showAction = action && !gate.active

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <div className="rounded-full bg-[hsl(var(--muted))] p-4">
        <Icon className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
      </div>
      <div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-xs text-xs text-[hsl(var(--muted-foreground))]">{description}</p>
        )}
      </div>
      {showAction && <div className="mt-1">{action}</div>}
    </div>
  )
}
