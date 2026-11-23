import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeSelectPosition } from '@/lib/selectPosition'
import { selectItemLabel } from '@/lib/selectLabel'
import { matchesQuery } from '@/lib/selectFilter'
import { useFieldId, useFieldLabelId } from './field'

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
  /** The option the keyboard is on (its element's id), while the list is open. */
  activeId: string | null
  setActiveId: (id: string | null) => void
  /** Close the list and give focus back to the trigger, as a keyboard choice or Escape does. */
  closeToTrigger: () => void
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
  activeId: null,
  setActiveId: () => {},
  closeToTrigger: () => {},
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
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const value = controlledValue !== undefined ? controlledValue : internalValue

  // Focus goes back to the trigger whenever a choice closes the list: the list it was in is gone, and a
  // keyboard user left on <body> starts again at the top of the page.
  function closeToTrigger() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleValueChange(v: string) {
    setInternalValue(v)
    onValueChange?.(v)
    closeToTrigger()
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
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen, triggerRef, registerLabel, getLabel, listboxId, activeId, setActiveId, closeToTrigger }}>
      {children}
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, id, onKeyDown, ...props }, ref) => {
    const { open, setOpen, triggerRef, listboxId } = React.useContext(SelectContext)
    // The trigger is the focusable control, so a <Field>'s label points here.
    const fieldId = useFieldId(id)
    /*
      Named by the label *and* its own content — see `useFieldLabelId`. Without
      the self-reference the label simply replaces the value, and the trigger
      stops announcing the answer it is showing. Skipped when the caller named
      the trigger itself, which is how the triggers outside a <Field> are named.
    */
    const fieldLabelId = useFieldLabelId()
    const named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
    const labelledBy = !named && fieldLabelId && fieldId ? `${fieldLabelId} ${fieldId}` : undefined

    function handleRef(el: HTMLButtonElement | null) {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el
    }

    return (
      <button
        ref={handleRef}
        id={fieldId}
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
        aria-labelledby={labelledBy}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          // ↓, ↑ and Alt+↓ open the list, as a native select does; Enter and Space are the button's own click.
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true) }
          onKeyDown?.(e)
        }}
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
  const { open, triggerRef, listboxId, onValueChange, activeId, setActiveId, closeToTrigger } = React.useContext(SelectContext)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const [query, setQuery] = React.useState('')
  const listRef = React.useRef<HTMLDivElement>(null)
  const filterRef = React.useRef<HTMLInputElement>(null)
  const typed = React.useRef({ text: '', at: 0 })

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
        /*
          A filtered list is a long list, and a long list is one whose options
          are worth reading. The trigger that opens it is often much narrower
          than the options it holds. An unfiltered one is given a floor too:
          the Revisions *Link* chip is 70px, and its list of chapters, scenes
          and characters wrapped one word to a line (UX-2-13).
        */
        { minWidth: filterPlaceholder ? 320 : 224 },
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

  /*
    The keyboard (UX-2-1). The list is the WAI-ARIA listbox it already said it
    was: ↑ ↓ Home End move, Enter (and Space, where there is no filter to type a
    space into) choose, typing jumps to an option that starts with what is
    typed, and Escape and Tab close the list and nothing else. Focus is in the
    list, or in its filter box, and `aria-activedescendant` says which option it
    is on: the options stay plain elements, so a click works as it did.
  */
  const options = React.useCallback(
    () => Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? []),
    [],
  )
  const moveTo = React.useCallback((el: HTMLElement | undefined) => {
    if (!el) return
    setActiveId(el.id)
    el.scrollIntoView?.({ block: 'nearest' })
  }, [setActiveId])

  // Opening: the keyboard lands on the chosen option, or the first. A filter keeps focus in its box.
  React.useEffect(() => {
    if (!open || !pos) return
    const all = options()
    const chosen = all.find((o) => o.getAttribute('aria-selected') === 'true')
    moveTo(chosen ?? all[0])
    if (!filterPlaceholder) listRef.current?.focus({ preventScroll: true })
  }, [open, Boolean(pos)]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (!open) setActiveId(null) }, [open, setActiveId])
  // Typing in the filter: the keyboard is on the first option still shown.
  React.useEffect(() => { if (open && filterPlaceholder) moveTo(options()[0]) }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  /*
    Escape and Tab are taken before anything else hears them. Escape is the
    shared dialog's on `document` (`useModalLayer`), so a list open in a dialog
    closed the dialog with it; Tab is the dialog's focus trap's, which knows
    nothing of a list drawn outside the panel. Caught in the capture phase, on
    the window, they close the list and stop there.
  */
  React.useEffect(() => {
    if (!open) return
    const take = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Tab') return
      const here = listRef.current?.contains(document.activeElement) || filterRef.current === document.activeElement
        || triggerRef.current === document.activeElement
      if (!here) return
      e.preventDefault()
      e.stopImmediatePropagation()
      closeToTrigger()
    }
    window.addEventListener('keydown', take, true)
    return () => window.removeEventListener('keydown', take, true)
  }, [open, closeToTrigger, triggerRef])

  function onKeyDown(e: React.KeyboardEvent) {
    const all = options()
    const at = all.findIndex((o) => o.id === activeId)
    const choose = () => {
      const v = all[at]?.dataset.value
      if (v !== undefined) onValueChange(v)
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveTo(all[Math.min(at + 1, all.length - 1)] ?? all[0]); return
      case 'ArrowUp': e.preventDefault(); moveTo(all[Math.max(at - 1, 0)] ?? all[0]); return
      case 'Home': if (filterPlaceholder) return; e.preventDefault(); moveTo(all[0]); return
      case 'End': if (filterPlaceholder) return; e.preventDefault(); moveTo(all[all.length - 1]); return
      case 'Enter': e.preventDefault(); choose(); return
      case ' ': if (filterPlaceholder) return; e.preventDefault(); choose(); return
    }
    // Typeahead, where there is no filter box to type into: the options that start with what was typed.
    if (filterPlaceholder || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
    const now = Date.now()
    typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
    const label = (o: HTMLElement) => (o.textContent ?? '').trim().toLowerCase()
    const from = typed.current.text.length > 1 ? at : at + 1
    const ordered = [...all.slice(Math.max(from, 0)), ...all.slice(0, Math.max(from, 0))]
    moveTo(ordered.find((o) => label(o).startsWith(typed.current.text)))
  }

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
                  ref={filterRef}
                  autoFocus
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={activeId ?? undefined}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={filterPlaceholder}
                  aria-label={filterPlaceholder}
                  className="h-8 w-full bg-transparent text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]"
                />
              </div>
            )}
            <div
              ref={listRef}
              role="listbox"
              id={listboxId}
              tabIndex={-1}
              aria-activedescendant={filterPlaceholder ? undefined : activeId ?? undefined}
              onKeyDown={filterPlaceholder ? undefined : onKeyDown}
              className={cn('min-h-0 flex-1 overflow-auto p-1 outline-none', className)}
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
  const { value: selectedValue, onValueChange, registerLabel, activeId, setActiveId } = React.useContext(SelectContext)
  const isSelected = selectedValue === value
  const id = React.useId()
  const isActive = activeId === id

  const label = textValue ?? selectItemLabel(children)
  React.useEffect(() => {
    registerLabel(value, label)
  }, [value, label]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      id={id}
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      data-value={value}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none',
        disabled ? 'pointer-events-none opacity-50' : 'hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
        isSelected && 'bg-[hsl(var(--accent))]',
        // Where the keyboard is: a ring, so it is not mistaken for the option already chosen.
        isActive && 'ring-2 ring-inset ring-[hsl(var(--ring))]',
        className
      )}
      onMouseMove={() => { if (!disabled && !isActive) setActiveId(id) }}
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
