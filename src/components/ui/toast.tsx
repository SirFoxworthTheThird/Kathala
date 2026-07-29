import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useAppStore, type Toast } from '@/store'
import { cn } from '@/lib/utils'

/** How long a toast stays before dismissing itself. */
export const TOAST_DURATION_MS = 7_000

function ToastRow({ toast }: { toast: Toast }) {
  const dismissToast = useAppStore((s) => s.dismissToast)

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, dismissToast])

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-3 rounded-lg border border-[hsl(var(--border))]',
        'bg-[hsl(var(--card))] px-3 py-2 shadow-lg',
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-[hsl(var(--foreground))]">
        {toast.message}
      </span>
      {toast.actionLabel && toast.onAction && (
        <button
          onClick={() => {
            toast.onAction?.()
            dismissToast(toast.id)
          }}
          className="pw-tap shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] transition-colors"
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss"
        className="pw-tap shrink-0 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * Bottom-anchored toasts.
 *
 * Bottom rather than top because the one action they carry — Undo — needs to be
 * reachable with a thumb on a phone, and because the top of the screen is
 * already the app's densest region.
 */
export function Toaster() {
  const toasts = useAppStore((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[3000] flex flex-col items-center gap-2 p-3 sm:items-end sm:p-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="w-full max-w-sm">
          <ToastRow toast={toast} />
        </div>
      ))}
    </div>
  )
}
