import * as React from 'react'
import { cn } from '@/lib/utils'
import { useFieldId } from './field'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, id, ...props }, ref) => {
    // Picks up the id its <Field> minted, so the label points at it (N10).
    const fieldId = useFieldId(id)
    return (
      <input
        id={fieldId}
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-1 text-sm text-[hsl(var(--foreground))] shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
