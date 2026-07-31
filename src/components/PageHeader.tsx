import type { LucideIcon } from 'lucide-react'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Section icon, shown beside the title. */
  icon?: LucideIcon
  /** Page title — the section's identity. */
  title: string
  /** Optional count shown next to the title (e.g. number of items). */
  count?: number
  /** One-line description of what the section is for. */
  description?: string
  /** Primary action(s), anchored to the top-right of the header. */
  actions?: React.ReactNode
  /** Optional secondary row below the title — search inputs, filters, tabs. */
  children?: React.ReactNode
  className?: string
}

/**
 * Standard page header for list/roster views. Gives every section a consistent
 * hierarchy: a clear title (with optional count) and a one-line purpose on the
 * left, the primary action anchored top-right, and an optional toolbar row
 * (search, filters) underneath.
 */
export function PageHeader({
  icon: Icon,
  title,
  count,
  description,
  actions,
  children,
  className,
}: PageHeaderProps) {
  // Page-header actions are, without exception, authoring controls — Add,
  // New, Generate with AI. Dropping them here rather than in each view means a
  // screen added later is right by default, which is the same reason gating
  // lives in the hooks rather than the lists.
  const gate = useGate()
  const showActions = actions && !gate.active

  return (
    <div
      className={cn(
        'shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {Icon && (
              <Icon
                className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]"
                aria-hidden="true"
              />
            )}
            <h1 className="truncate text-base font-semibold leading-tight text-[hsl(var(--foreground))]">
              {title}
            </h1>
            {count !== undefined && (
              <span className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs font-medium tabular-nums text-[hsl(var(--muted-foreground))]">
                {count}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 lg:truncate">
              {description}
            </p>
          )}
        </div>
        {showActions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
