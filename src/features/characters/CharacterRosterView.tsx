import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { useCharacters } from '@/db/hooks/useCharacters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/EmptyState'
import { CharacterCard } from './CharacterCard'
import { CreateCharacterDialog } from './CreateCharacterDialog'

export default function CharacterRosterView() {
  const { worldId } = useParams<{ worldId: string }>()
  const characters = useCharacters(worldId ?? null)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtered = characters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
        <Input
          placeholder="Search characters…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs text-sm"
        />
        <Button size="sm" className="ml-auto" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Character
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={characters.length === 0 ? 'No characters yet' : 'No matches'}
            description={characters.length === 0 ? 'Add your first character to start tracking.' : 'Try a different search.'}
            action={
              characters.length === 0 ? (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Character
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <CharacterCard key={c.id} character={c} />
            ))}
          </div>
        )}
      </div>

      {worldId && (
        <CreateCharacterDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          worldId={worldId}
        />
      )}
    </div>
  )
}
