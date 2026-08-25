import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label, labelClass } from './label'

/**
 * A labelled form control, associated automatically.
 *
 * N10, from a blind writer run: the app's most-used editing form — Character →
 * Current State — was measured live in the DOM and every control in it had
 * `id: null`, `aria-label: null`, `aria-labelledby: null`, and no wrapping
 * `<label>`. A screen reader announced the location picker as an unnamed
 * collapsed button. The Add Location dialog was the same, to the point where
 * clicking "Name (required)" did not even focus the field beside it.
 *
 * Fixed here rather than at each of the eighty-odd call sites, and without a
 * prop to remember: `Field` mints an id, gives it to the label's `htmlFor`, and
 * puts it on the context that `Input`, `Textarea` and `SelectTrigger` read. The
 * markup a writer of one of these panels has to get right is the wrapper they
 * were already writing.
 *
 * One control per `Field`. Two would share an id, which is worse than neither
 * having one — for a group of controls (a pair of Alive/Deceased buttons) the
 * shape is a `role="group"` with its own name, and for a label over something
 * that is not a control at all, see `FieldName`.
 */
interface FieldIds {
  /** Goes on the control, and is what the label's `htmlFor` points at. */
  id: string
  /** Goes on the label, so a control can name itself by label *and* content. */
  labelId: string
}

const FieldIdContext = React.createContext<FieldIds | undefined>(undefined)

/** The id a `Field` minted for its control, unless the caller set its own. */
export function useFieldId(explicit?: string): string | undefined {
  const fromField = React.useContext(FieldIdContext)
  return explicit ?? fromField?.id
}

/**
 * The id of this field's label, for a control whose *content* is also part of
 * its name.
 *
 * An associated `<label>` does not add to a button's name, it replaces it. So
 * wrapping the location picker in a `Field` made it announce "Current Location"
 * where it used to announce "Château d'If" — the field gained a name and the
 * answer disappeared, and a voice-control user asking for what they could see
 * on screen no longer had anything to say. Ten specs caught this by looking
 * these triggers up by their value.
 *
 * `aria-labelledby` listing the label and then the control itself is the usual
 * shape for a select: the control's own content is spliced back in, and the
 * name becomes "Current Location Château d'If" — the field and its answer.
 */
export function useFieldLabelId(): string | undefined {
  return React.useContext(FieldIdContext)?.labelId
}

interface FieldProps {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
  labelClassName?: string
}

export function Field({ label, children, className, labelClassName }: FieldProps) {
  const id = React.useId()
  const labelId = `${id}-label`
  const ids = React.useMemo(() => ({ id, labelId }), [id, labelId])
  return (
    <FieldIdContext.Provider value={ids}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <Label id={labelId} htmlFor={id} className={labelClassName}>{label}</Label>
        {children}
      </div>
    </FieldIdContext.Provider>
  )
}

/**
 * A field's name where there is no single control for it to name.
 *
 * Reading mode renders the same panels as text, so "Status" sits above a
 * `<span>` saying Alive; "Inventory" sits above a list. A `<label>` pointing at
 * nothing is not a missing association, it is a false one — it tells a screen
 * reader a control is coming and then does not produce one. This is the same
 * text at the same weight, as a span.
 */
export function FieldName(
  { children, className, id }: { children: React.ReactNode; className?: string; id?: string },
) {
  return <span id={id} className={cn(labelClass, className)}>{children}</span>
}
