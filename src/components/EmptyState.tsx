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
