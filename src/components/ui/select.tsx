import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  registerLabel: (value: string, label: string) => void
  getLabel: (value: string) => string | undefined
}

const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
  registerLabel: () => {},
  getLabel: () => undefined,
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
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen, triggerRef, registerLabel, getLabel }}>
      {children}
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, triggerRef } = React.useContext(SelectContext)

    function handleRef(el: HTMLButtonElement | null) {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el
    }

    return (
      <button
        ref={handleRef}
        type="button"
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
}

function SelectContent({ children, className }: SelectContentProps) {
  const { open, triggerRef } = React.useContext(SelectContext)
  const [rect, setRect] = React.useState<DOMRect | null>(null)

  React.useEffect(() => {
    if (open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect())
    }
  }, [open, triggerRef])

  return (
    <>
      {/* Always render hidden copy so SelectItems can register their labels */}
      <div style={{ display: 'none' }}>{children}</div>

      {open && rect && createPortal(
        <div
          style={{
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 99999,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            role="listbox"
            className={cn(
              'max-h-64 overflow-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1 shadow-lg',
              className
            )}
          >
            {children}
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
}

function SelectItem({ value, children, className, disabled }: SelectItemProps) {
  const { value: selectedValue, onValueChange, registerLabel } = React.useContext(SelectContext)
  const isSelected = selectedValue === value

  const label = typeof children === 'string' ? children : ''
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
