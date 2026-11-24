import { CreateEntityDialog } from '@/components/CreateEntityDialog'
import { characterNamed } from '@/db/hooks/useCharacters'
import { useAppStore } from '@/store'

interface CreateCharacterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function CreateCharacterDialog({ open, onOpenChange, worldId }: CreateCharacterDialogProps) {
  const pushToast = useAppStore((s) => s.pushToast)
  return (
    <CreateEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add Character"
      noun="character"
      idPrefix="create-character"
      namePlaceholder="Character name"
      descriptionPlaceholder="Brief description..."
      onCreate={async (name, description) => {
        // In a book of a series, a name its cast already has is that person, not a second one (UX-1-6, D-7).
        const { character, existing } = await characterNamed({ worldId, name, description })
        if (existing) pushToast({ message: `${character.name} is already in your series’ cast` })
        return character
      }}
    />
  )
}
