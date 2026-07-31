import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Users, Sparkles } from 'lucide-react'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { SpoilerNote } from '@/components/SpoilerNote'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { CharacterCard } from './CharacterCard'
import { CreateCharacterDialog } from './CreateCharacterDialog'
import { GenerateCharactersDialog } from './GenerateCharactersDialog'

export default function CharacterRosterView() {
  const { worldId } = useParams<{ worldId: string }>()
  const characters = useCharacters(worldId ?? null)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  // `useCharacters` is already gated, so the count of what is being held back
  // comes from the gate rather than from re-fetching the ungated cast.
  const gate = useGate()
  const hidden = gate.hiddenCounts.characters

  const filtered = characters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Users}
        title="Characters"
        count={characters.length}
        description="The cast you're tracking across the story."
        actions={
          // Reading mode is for someone following a published book; offering to
          // add to its cast is noise at best and an invitation to damage the
          // reference at worst. "Make a copy" in world settings is the way out.
          gate.active ? undefined : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAiOpen(true)}>
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Character
              </Button>
            </div>
          )
        }
      >
        <Input
          placeholder="Search characters…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs text-sm"
        />
      </PageHeader>

      <div className="flex-1 overflow-auto p-4">
        <SpoilerNote gate={gate} hidden={hidden} noun="characters" />
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={characters.length === 0 ? 'No characters yet' : 'No matches'}
            description={
              characters.length === 0
                ? gate.active
                  ? 'Nobody has appeared yet at this point in the story.'
                  : 'Add your first character to start tracking.'
                : 'Try a different search.'
            }
            action={
              characters.length === 0 && !gate.active ? (
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
        <>
          <CreateCharacterDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            worldId={worldId}
          />
          <GenerateCharactersDialog
            open={aiOpen}
            onOpenChange={setAiOpen}
            worldId={worldId}
          />
        </>
      )}
    </div>
  )
}
