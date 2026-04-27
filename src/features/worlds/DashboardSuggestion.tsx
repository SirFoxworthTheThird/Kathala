import { X, ArrowRight } from 'lucide-react'

interface DashboardSuggestionProps {
  title: string
  navLabel: string
  dismissible: boolean
  onNavigate: () => void
  onDismiss?: () => void
}

export function DashboardSuggestion({
  title,
  navLabel,
  dismissible,
  onNavigate,
  onDismiss,
}: DashboardSuggestionProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 transition-colors hover:border-[hsl(var(--ring)/0.4)]">
      <div className="flex flex-1 items-center justify-between gap-4 min-w-0">
        <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
          {title}
        </span>
        <button
          onClick={onNavigate}
          className="flex shrink-0 items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded"
          aria-label={`${title} — ${navLabel}`}
        >
          {navLabel}
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          aria-label={`Dismiss: ${title}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground)/0.5)] hover:text-[hsl(var(--muted-foreground))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
