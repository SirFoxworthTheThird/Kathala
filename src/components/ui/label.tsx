import * as React from 'react'
import { cn } from '@/lib/utils'

/** Shared so `FieldName` can look identical without being a `<label>`. */
export const labelClass =
  'text-sm font-medium leading-none text-[hsl(var(--foreground))] peer-disabled:cursor-not-allowed peer-disabled:opacity-70'

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn(labelClass, className)} {...props} />
  )
)
Label.displayName = 'Label'

export { Label }
