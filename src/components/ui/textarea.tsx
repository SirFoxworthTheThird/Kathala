import * as React from 'react'
import { cn } from '@/lib/utils'
import { useFieldId } from './field'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, id, ...props }, ref) => {
    // Picks up the id its <Field> minted, so the label points at it (N10).
    const fieldId = useFieldId(id)
    return (
      <textarea
        id={fieldId}
        className={cn(
          'flex min-h-[60px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
