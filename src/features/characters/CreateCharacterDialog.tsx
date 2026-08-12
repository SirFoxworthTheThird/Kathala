import { CreateEntityDialog } from '@/components/CreateEntityDialog'
import { createCharacter } from '@/db/hooks/useCharacters'

interface CreateCharacterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function CreateCharacterDialog({ open, onOpenChange, worldId }: CreateCharacterDialogProps) {
  return (
    <CreateEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add Character"
      noun="character"
      idPrefix="create-character"
      namePlaceholder="Character name"
      descriptionPlaceholder="Brief description..."
      onCreate={(name, description) => createCharacter({ worldId, name, description })}
    />
  )
}
