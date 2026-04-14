import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, Trash2 } from 'lucide-react'
import { useCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { updateCharacter } from '@/db/hooks/useCharacters'
import { storeBlob } from '@/db/hooks/useBlobs'
import { PortraitImage } from '@/components/PortraitImage'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { OverviewTab } from './tabs/OverviewTab'
import { CurrentStateTab } from './tabs/CurrentStateTab'
import { HistoryTab } from './tabs/HistoryTab'
import { RelationshipsTab } from './tabs/RelationshipsTab'

export default function CharacterDetailView() {
  const { worldId, characterId } = useParams<{ worldId: string; characterId: string }>()
  const navigate = useNavigate()
  const character = useCharacter(characterId ?? null)

  if (!character) {
    return (
      <div className="flex h-full items-center justify-center text-[hsl(var(--muted-foreground))]">
        Character not found.
      </div>
    )
  }

  async function handlePortraitUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !worldId) return
    const blob = await storeBlob(worldId, file)
    await updateCharacter(character!.id, { portraitImageId: blob.id })
  }

  async function handleDelete() {
    if (confirm(`Delete "${character!.name}"?`)) {
      await deleteCharacter(character!.id)
      navigate(`/worlds/${worldId}/characters`)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Portrait */}
        <div className="relative">
          <PortraitImage
            imageId={character.portraitImageId}
            alt={character.name}
            className="h-12 w-12 rounded-full object-cover"
            fallbackClassName="h-12 w-12 rounded-full"
          />
          <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-[hsl(var(--accent))] p-1 hover:bg-[hsl(var(--secondary))]">
            <Upload className="h-3 w-3 text-[hsl(var(--foreground))]" />
            <input type="file" accept="image/*" className="hidden" onChange={handlePortraitUpload} />
          </label>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">{character.name}</h2>
          {character.aliases.length > 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{character.aliases.join(', ')}</p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8 hover:text-red-400"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="overview">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="state">Current State</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="relationships">Relationships</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <OverviewTab character={character} />
          </TabsContent>
          <TabsContent value="state">
            <CurrentStateTab character={character} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab character={character} />
          </TabsContent>
          <TabsContent value="relationships">
            <RelationshipsTab character={character} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
