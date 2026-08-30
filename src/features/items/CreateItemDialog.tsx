import { CreateEntityDialog } from '@/components/CreateEntityDialog'
import { createItem } from '@/db/hooks/useItems'

interface CreateItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function CreateItemDialog({ open, onOpenChange, worldId }: CreateItemDialogProps) {
  return (
    <CreateEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add Item"
      noun="item"
      idPrefix="create-item"
      namePlaceholder="Item name"
      descriptionPlaceholder="Brief description..."
      onCreate={(name, description) =>
        createItem({ worldId, name, description, iconType: '', tags: [] })}
    />
  )
}
