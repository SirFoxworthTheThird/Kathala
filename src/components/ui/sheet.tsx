import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useModalLayer } from './dialog'

/**
 * A panel that slides over the page on a narrow screen: in from the left, as
 * the navigation drawer does, or up from the bottom.
 *
 * For what sits *beside* the page where there is room and has nowhere to go
 * where there is not — the Manuscript's binder and its open chapter. Put in
 * the page instead, above what it belongs to, the chapter's panel pushed the
 * writing three thousand pixels down a phone the first time the caret moved.
 *
 * Modal, as a `Dialog` is, and one layer of the same stack: Escape closes the
 * innermost, focus goes in on opening and comes back on closing. Closing is
 * the caller's: the content carries its own close control, since a sheet's
 * content is usually a panel that already has one.
 */
export function Sheet({ open, onClose, label, side, id, children, className }: {
  open: boolean
  onClose: () => void
  /** The sheet's accessible name. */
  label: string
  side: 'left' | 'bottom'
  id?: string
  children: React.ReactNode
  className?: string
}) {
  useModalLayer(open, onClose)
  if (!open) return null
  return <SheetPanel onClose={onClose} label={label} side={side} id={id} className={className}>{children}</SheetPanel>
}

function SheetPanel({ onClose, label, side, id, children, className }: {
  onClose: () => void
  label: string
  side: 'left' | 'bottom'
  id?: string
  children: React.ReactNode
  className?: string
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, true)
  React.useEffect(() => {
    const panel = panelRef.current
    if (!panel || panel.contains(document.activeElement)) return
    panel.focus()
  }, [])
  return createPortal(
    <div className="fixed inset-0 z-[2000]">
      <div className="pw-anim-fade-in absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'absolute flex flex-col overflow-hidden border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl outline-none',
          side === 'left'
            ? 'pw-anim-slide-in-left inset-y-0 left-0 w-72 max-w-[85%] border-r'
            : 'pw-anim-slide-in-up inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
