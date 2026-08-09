import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/lib/useFocusTrap'

interface DialogContextValue {
  onClose: () => void
  /** Id the title always claims. */
  titleId: string
  /** The same id, but only once a title is actually mounted to carry it. */
  labelledBy: string
  registerTitle: (present: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue>({
  onClose: () => {},
  titleId: '',
  labelledBy: '',
  registerTitle: () => {},
})

/**
 * Which dialogs are open, innermost last.
 *
 * Escape is listened for on `document`, so without this every open dialog hears
 * every press: backing out of a confirm stacked on Scene history closed the
 * confirm *and* the history behind it, discarding the context the decision was
 * being made in. Only the innermost dialog reacts.
 */
const openDialogs: symbol[] = []

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const idRef = React.useRef<symbol | null>(null)
  if (idRef.current === null) idRef.current = Symbol('dialog')
  const titleId = React.useId()
  const [hasTitle, setHasTitle] = React.useState(false)

  // Whatever had focus when this dialog opened, so it can be handed back.
  //
  // Captured during *render* rather than in an effect: child effects run before
  // parent ones, so a dialog whose form focuses its first field has already
  // moved focus by the time any effect here would look — the restore target
  // ended up being an input inside the dialog rather than the button outside
  // that opened it. During render no child has mounted yet.
  const restoreRef = React.useRef<HTMLElement | null>(null)
  const wasOpenRef = React.useRef(false)
  if (open && !wasOpenRef.current) {
    restoreRef.current = document.activeElement as HTMLElement | null
  }
  wasOpenRef.current = open

  React.useEffect(() => {
    if (!open) return
    const id = idRef.current!
    openDialogs.push(id)
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (openDialogs[openDialogs.length - 1] !== id) return
      onOpenChange(false)
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      const i = openDialogs.lastIndexOf(id)
      if (i !== -1) openDialogs.splice(i, 1)
      // Hand focus back, so a keyboard user resumes where they were instead of
      // at the top of the document. Skipped when whatever opened this is gone
      // from the page, or when focus has already been placed somewhere real.
      const active = document.activeElement as HTMLElement | null
      const dropped = !active || active === document.body
      const target = restoreRef.current
      if (dropped && target?.isConnected) target.focus()
    }
  }, [open, onOpenChange])

  const ctx = React.useMemo<DialogContextValue>(() => ({
    onClose: () => onOpenChange(false),
    titleId,
    labelledBy: hasTitle ? titleId : '',
    registerTitle: setHasTitle,
  }), [onOpenChange, hasTitle, titleId])

  if (!open) return null

  return <DialogContext.Provider value={ctx}>{children}</DialogContext.Provider>
}

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { onClose, labelledBy } = React.useContext(DialogContext)
    const panelRef = React.useRef<HTMLDivElement>(null)

    // Tab stays inside the dialog. Without this the ring walks out into the page
    // behind a full-screen overlay: measured at 390px, 7 of 10 Tabs left an open
    // Add Character dialog, and the ring lands on things the user cannot see.
    useFocusTrap(panelRef, true)

    // Move focus into the dialog, unless a field inside has already claimed it
    // — several forms focus their first input, and that is a better landing
    // place than anything chosen here. Handing focus back on close is `Dialog`'s
    // job, since only it can capture the opener before children mount.
    React.useEffect(() => {
      const panel = panelRef.current
      if (!panel || panel.contains(document.activeElement)) return
      const first = panel.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      ;(first ?? panel).focus()
    }, [])

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div
          ref={(node) => {
            panelRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
          }}
          role="dialog"
          aria-modal="true"
          {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
          tabIndex={-1}
          className={cn(
            'relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border shadow-xl',
            'border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6',
            className
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {children}
          <button
            onClick={onClose}
            className="pw-tap absolute right-4 top-4 rounded-sm p-1 text-[hsl(var(--muted-foreground))] opacity-70 hover:opacity-100 focus:outline-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </div>,
      document.body
    )
  }
)
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 mb-4', className)} {...props} />
)

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
)

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, id, ...props }, ref) => {
    const { titleId, registerTitle } = React.useContext(DialogContext)
    // Tell the panel a title exists, so it only claims `aria-labelledby` when
    // there is something for it to point at.
    React.useEffect(() => {
      registerTitle(true)
      return () => registerTitle(false)
    }, [registerTitle])
    return (
      <h2
        ref={ref}
        id={id ?? (titleId || undefined)}
        className={cn('text-lg font-semibold leading-none tracking-tight text-[hsl(var(--foreground))]', className)}
        {...props}
      />
    )
  }
)
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-[hsl(var(--muted-foreground))]', className)} {...props} />
  )
)
DialogDescription.displayName = 'DialogDescription'

function DialogClose({ children }: { children?: React.ReactNode }) {
  const { onClose } = React.useContext(DialogContext)
  return <button onClick={onClose}>{children}</button>
}

// Keep these exports for compatibility — they're no-ops now
const DialogTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>
const DialogPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>

export {
  Dialog, DialogPortal, DialogClose, DialogTrigger,
  DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
}
