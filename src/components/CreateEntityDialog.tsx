import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CreateEntityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dialog heading and the submit button's label, e.g. "Add Item". */
  title: string
  /** The noun on its own, for the second button: "Add another item". */
  noun: string
  namePlaceholder: string
  descriptionPlaceholder: string
  /** Ids for the two fields, so a label points at exactly one input. */
  idPrefix: string
  onCreate: (name: string, description: string) => Promise<unknown>
}

/**
 * One create dialog for the name-and-description rosters.
 *
 * HB-7 filed the rosters as *"creation flows return the writer to inconsistent
 * places"*, and the diff was the finding: `CreateItemDialog` and
 * `CreateCharacterDialog` were byte-identical apart from which function they
 * called, and behaved differently only because one roster passed an `onCreated`
 * that navigated and the other passed nothing. Two copies agreeing is a
 * coincidence, and this pair had already stopped agreeing.
 *
 * **Creating leaves you on the roster**, for both. That is the half of the
 * finding about serial entry — *"a writer adding a cast can continue quickly,
 * while adding several props requires repeated navigation back to Items"* — and
 * the detail page is one click from the card either way. **Add another** keeps
 * the dialog open with the fields cleared and the cursor back in the name, so
 * typing a cast list never touches the mouse.
 */
export function CreateEntityDialog({
  open, onOpenChange, title, noun, namePlaceholder, descriptionPlaceholder, idPrefix, onCreate,
}: CreateEntityDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  async function create(keepOpen: boolean) {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await onCreate(name.trim(), description.trim())
    } finally {
      setSaving(false)
    }
    setName('')
    setDescription('')
    if (keepOpen) nameRef.current?.focus()
    else onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void create(false) }} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            {/* Associated rather than adjacent: these were labelled only by
                their placeholder, which is no name once the field has a value. */}
            <Label htmlFor={`${idPrefix}-name`}>Name</Label>
            <Input
              id={`${idPrefix}-name`}
              ref={nameRef}
              placeholder={namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-description`}>Description</Label>
            <Textarea
              id={`${idPrefix}-description`}
              placeholder={descriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="button"
              variant="outline"
              disabled={!name.trim() || saving}
              onClick={() => void create(true)}
            >
              Add another {noun}
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? 'Saving...' : title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
