import * as React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Where a destructive action lives (TL-3, EV-5, CH-4, LORE-1).
 *
 * Delete was drawn like everything else it sat beside: a trash icon on all 22
 * chapter rows, immediately next to open-detail; another in every event card's
 * header beside the status pill and the reorder arrows; another alone in the
 * character header. Twenty-two chances to misclick the most destructive action
 * on the screen, with nothing in the affordance suggesting weight.
 *
 * The review proposed copying the Lore roster, which reveals its delete on
 * hover. Measured, that pattern is worse than the one it would replace: at rest
 * the button is `opacity: 0` with `pointer-events: auto` and it still hit-tests
 * to itself, so on a touch device — where there is no hover and the resting
 * state is the only state — a tap on blank card deletes the page. It was also
 * 14×14px and carried no accessible name at all. Hiding a control is not the
 * same as giving it weight.
 *
 * So the answer is a menu instead: one named, always-visible trigger, with the
 * destructive item one deliberate step inside it. That works the same on a
 * phone as on a desktop, keeps delete out of the routine row, and costs a click
 * exactly where a click should be costly.
 *
 * The map's toolbar has its own overflow menu and is deliberately left alone —
 * it is a floating cluster over a canvas with its own layout rules, and it
 * groups set-up commands rather than guarding a destructive one.
 */

interface MenuContextValue {
  close: (restoreFocus?: boolean) => void
}

const MenuContext = React.createContext<MenuContextValue>({ close: () => {} })

/** Every focusable item currently in the popup, in DOM order. */
function itemsOf(el: HTMLElement | null): HTMLElement[] {
  if (!el) return []
  return Array.from(el.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'))
}

export function Menu({
  label,
  children,
  align = 'right',
  className,
  triggerClassName,
}: {
  /** The trigger's accessible name — say what it is a menu *for*. */
  label: string
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
  triggerClassName?: string
}) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popupRef = React.useRef<HTMLDivElement>(null)
  // Set when the menu is opened from the keyboard, so focus lands on an item
  // rather than staying on the trigger. A pointer user gets neither.
  const focusFirstRef = React.useRef(false)

  const close = React.useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  React.useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  React.useEffect(() => {
    if (!open || !focusFirstRef.current) return
    focusFirstRef.current = false
    itemsOf(popupRef.current)[0]?.focus()
  }, [open])

  function onPopupKeyDown(e: React.KeyboardEvent) {
    const items = itemsOf(popupRef.current)
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[i < 0 || i === items.length - 1 ? 0 : i + 1].focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[i <= 0 ? items.length - 1 : i - 1].focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0].focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1].focus()
    } else if (e.key === 'Tab') {
      // Tabbing away is a decision to leave, so the menu goes with it — and
      // without restoring focus, which would fight the Tab.
      close(false)
    }
  }

  const ctx = React.useMemo(() => ({ close }), [close])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          focusFirstRef.current = true
          setOpen(true)
        }}
        className={cn(
          'pw-tap inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
          'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]',
          open && 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
          triggerClassName,
        )}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={popupRef}
          role="menu"
          aria-label={label}
          onKeyDown={onPopupKeyDown}
          className={cn(
            'absolute top-full z-[1200] mt-1 min-w-[168px] rounded-lg border py-1 shadow-xl shadow-black/30',
            'border-[hsl(var(--border))] bg-[hsl(var(--card))]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <MenuContext.Provider value={ctx}>{children}</MenuContext.Provider>
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon: Icon,
  label,
  danger,
  disabled,
  onClick,
}: {
  icon?: React.ElementType
  label: string
  /** Destructive. Red text, and separated from whatever sits above it. */
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const { close } = React.useContext(MenuContext)
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      // Focus goes back to the trigger *before* the action runs, so a confirm
      // dialog opened from here captures the trigger as what to restore to
      // afterwards — `Dialog` reads the active element during its own render.
      // Closing without restoring would leave it capturing this button, which
      // has unmounted by then, and focus would fall to the body.
      onClick={() => { close(); onClick() }}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
        'focus-visible:outline-none focus-visible:bg-[hsl(var(--muted))]',
        'disabled:opacity-50',
        danger
          ? 'mt-1 border-t border-[hsl(var(--border))] pt-2 text-red-400 hover:bg-red-400/10'
          : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {label}
    </button>
  )
}
