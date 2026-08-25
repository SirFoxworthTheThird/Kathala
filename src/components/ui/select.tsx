import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeSelectPosition } from '@/lib/selectPosition'
import { selectItemLabel } from '@/lib/selectLabel'
import { matchesQuery } from '@/lib/selectFilter'

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  registerLabel: (value: string, label: string) => void
  getLabel: (value: string) => string | undefined
  /** So the trigger can point `aria-controls` at the list it opens. */
  listboxId: string
}

const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
  registerLabel: () => {},
  getLabel: () => undefined,
  listboxId: '',
})

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

function Select({ value: controlledValue, defaultValue = '', onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const [labels, setLabels] = React.useState<Record<string, string>>({})
  const listboxId = React.useId()

  const value = controlledValue !== undefined ? controlledValue : internalValue

  function handleValueChange(v: string) {
    setInternalValue(v)
    onValueChange?.(v)
    setOpen(false)
  }

  function registerLabel(itemValue: string, label: string) {
    setLabels((prev) => {
      if (prev[itemValue] === label) return prev
      return { ...prev, [itemValue]: label }
    })
  }

  function getLabel(itemValue: string) {
    return labels[itemValue]
  }

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen, triggerRef, registerLabel, getLabel, listboxId }}>
      {children}
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, triggerRef, listboxId } = React.useContext(SelectContext)

    function handleRef(el: HTMLButtonElement | null) {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el
    }

    return (
      <button
        ref={handleRef}
        type="button"
        /*
          F16: the trigger was a bare button, so a screen reader announced
          "Select…, button" and gave no sign that pressing it opens a list, or
          whether it is open. Two adjacent selects in the New Relationship
          dialog were announced identically and indistinguishably.

          `aria-haspopup` + `aria-expanded` on a button is the long-standing
          pattern for this and is what fixes all seventy selects in the app at
          once. The role stays `button` on purpose: `role="combobox"` is the
          newer APG shape, and switching it would change what every
          `getByRole('button', …)` in the suite resolves to for no gain a
          screen-reader user can hear.
        */
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        onClick={() => setOpen(!open)}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
    )
  }
)
SelectTrigger.displayName = 'SelectTrigger'

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value, getLabel } = React.useContext(SelectContext)
  const label = getLabel(value)
  return (
    <span className={cn(!label && 'text-[hsl(var(--muted-foreground))]')}>
      {label ?? placeholder ?? ''}
    </span>
  )
}

interface SelectContentProps {
  children: React.ReactNode
  className?: string
  /**
   * Puts a filter box at the top of the list, with this as its placeholder and
   * its accessible name.
   *
   * Opt-in rather than always-on: most selects in the app are a handful of
   * options, where a box to type in is one more thing between the writer and
   * the answer. It is for the lists that are as long as the book — see
   * `matchesQuery`.
   */
  filterPlaceholder?: string
  /** Shown when the filter excludes everything. */
  emptyLabel?: string
}

function SelectContent({ children, className, filterPlaceholder, emptyLabel = 'No matches' }: SelectContentProps) {
  const { open, triggerRef, listboxId } = React.useContext(SelectContext)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const [query, setQuery] = React.useState('')

  // A filter is about this opening of the list, not the last one.
  React.useEffect(() => { if (!open) setQuery('') }, [open])

  React.useEffect(() => {
    if (!open || !triggerRef.current) return
    const measure = () => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    }
    measure()
    // Keep the panel anchored if the viewport changes (rotation, keyboard, scroll).
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, triggerRef])

  // Fit the panel to the viewport so no options end up off-screen (it flips
  // above the trigger when there's more room up top, and scrolls internally).
  const pos = rect
    ? computeSelectPosition(
        rect,
        { width: window.innerWidth, height: window.innerHeight },
        // A filtered list is a long list, and a long list is one whose options
        // are worth reading. The trigger that opens it is often much narrower
        // than the options it holds.
        filterPlaceholder ? { minWidth: 320 } : {},
      )
    : null

  /*
    Filtering works on the item's own label — the same text `SelectItem`
    registers for the trigger — so an option reads and matches as one thing.
    Anything that is not a `SelectItem` (a separator, a heading) is left in
    place: it is not an option, so it is not a candidate to exclude.
  */
  const shown = filterPlaceholder
    ? React.Children.toArray(children).filter((child) => {
        if (!React.isValidElement(child)) return true
        const props = child.props as Partial<SelectItemProps>
        if (typeof props.value !== 'string') return true
        return matchesQuery(props.textValue ?? selectItemLabel(props.children), query)
      })
    : children
  const empty = filterPlaceholder && React.Children.count(shown) === 0

  return (
    <>
      {/*
        Always render a hidden copy of *every* child so SelectItems can register
        their labels — including the ones the filter is currently hiding, or the
        trigger would go blank whenever the selected option is filtered out.
      */}
      <div style={{ display: 'none' }}>{children}</div>

      {open && pos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            bottom: pos.bottom,
            left: pos.left,
            width: pos.width,
            zIndex: 99999,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            style={{ maxHeight: pos.maxHeight }}
            className="flex flex-col overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg"
          >
            {filterPlaceholder && (
              <div className="flex shrink-0 items-center gap-1.5 border-b border-[hsl(var(--border))] px-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={filterPlaceholder}
                  aria-label={filterPlaceholder}
                  className="h-8 w-full bg-transparent text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]"
                />
              </div>
            )}
            <div
              role="listbox"
              id={listboxId}
              className={cn('min-h-0 flex-1 overflow-auto p-1', className)}
            >
              {shown}
              {empty && (
                <p className="px-2 py-1.5 text-sm text-[hsl(var(--muted-foreground))]">{emptyLabel}</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
  /** Overrides the text shown in the trigger; defaults to the item's own text. */
  textValue?: string
}

function SelectItem({ value, children, className, disabled, textValue }: SelectItemProps) {
  const { value: selectedValue, onValueChange, registerLabel } = React.useContext(SelectContext)
  const isSelected = selectedValue === value

  const label = textValue ?? selectItemLabel(children)
  React.useEffect(() => {
    registerLabel(value, label)
  }, [value, label]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none',
        disabled ? 'pointer-events-none opacity-50' : 'hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
        isSelected && 'bg-[hsl(var(--accent))]',
        className
      )}
      onClick={() => !disabled && onValueChange(value)}
    >
      {children}
      {isSelected && (
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4" />
        </span>
      )}
    </div>
  )
}

const SelectGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
const SelectLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('px-2 py-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]', className)}>{children}</div>
)
const SelectSeparator = ({ className }: { className?: string }) => (
  <div className={cn('-mx-1 my-1 h-px bg-[hsl(var(--muted))]', className)} />
)
const SelectScrollUpButton = () => null
const SelectScrollDownButton = () => null

export {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent,
  SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton,
}
