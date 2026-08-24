import { useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Upload, Link2, Trash2 } from 'lucide-react'
import { useCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { updateCharacter } from '@/db/hooks/useCharacters'
import { storeBlob } from '@/db/hooks/useBlobs'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { NotReachedYet } from '@/components/NotReachedYet'
import { LinkImageButton } from '@/components/LinkImageButton'
import { PortraitImage } from '@/components/PortraitImage'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent, TabCount } from '@/components/ui/tabs'
import { useGoalsForCharacter } from '@/db/hooks/useCharacterGoals'
import { useCharacterRelationships } from '@/db/hooks/useRelationships'
import { useMembershipsForCharacter } from '@/db/hooks/useFactions'
import { useLorePagesForEntity } from '@/db/hooks/useLore'
import { useCharacterSnapshots } from '@/db/hooks/useSnapshots'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { computeCharacterAppearances } from '@/lib/characterAppearances'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { OverviewTab } from './tabs/OverviewTab'
import { CurrentStateTab } from './tabs/CurrentStateTab'
import { HistoryTab } from './tabs/HistoryTab'
import { AppearancesTab } from './tabs/AppearancesTab'
import { RelationshipsTab } from './tabs/RelationshipsTab'
import { RelatedLoreSection } from '@/features/lore'
import { FactionsTab } from './tabs/FactionsTab'
import { GoalsTab } from './tabs/GoalsTab'
import { Menu, MenuItem } from '@/components/ui/menu'

export default function CharacterDetailView() {
  const { worldId, characterId } = useParams<{ worldId: string; characterId: string }>()
  const navigate = useNavigate()
  const character = useCharacter(characterId ?? null)
  /*
    The tab lives in the query string so somewhere else can send you to it.
    The Arc grid and the chapter-detail cast rows both point at a character's
    Current State for a particular scene, and "go to the character, then find
    the tab" is two of the six-to-eight clicks that recording one state used to
    cost. `replace` so a run of these does not fill the back button.
  */
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'overview'
  const selectTab = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  const gate = useGate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [portraitLinkOpen, setPortraitLinkOpen] = useState(false)
  const portraitFileRef = useRef<HTMLInputElement>(null)

  // CH-3: each count comes from the same hook the tab itself reads, so the
  // number on the tab and the list behind it cannot disagree.
  const goals = useGoalsForCharacter(characterId ?? null)
  const relationships = useCharacterRelationships(characterId ?? null)
  const memberships = useMembershipsForCharacter(characterId ?? null)
  const lorePages = useLorePagesForEntity(worldId ?? null, characterId ?? null)
  const snapshots = useCharacterSnapshots(characterId ?? null)
  const worldEvents = useWorldEvents(character?.worldId ?? null)
  const worldChapters = useWorldChapters(character?.worldId ?? null)
  const appearances = computeCharacterAppearances({
    characterId: characterId ?? '',
    events: worldEvents,
    chapters: worldChapters,
  })
  const appearanceCount = appearances.present.length + appearances.mentioned.length

  if (!character) {
    return (
      <div className="flex h-full items-center justify-center text-[hsl(var(--muted-foreground))]">
        Character not found.
      </div>
    )
  }

  // Listed nowhere while unmet, but the page behind the listing rendered in
  // full for anyone who arrived by URL or by an older link.
  if (gate.active && !gate.isRevealed(character.id)) {
    return <NotReachedYet what="character" />
  }

  async function handlePortraitUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !worldId) return
    const blob = await storeBlob(worldId, file)
    await updateCharacter(character!.id, { portraitImageId: blob.id })
  }

  async function handleDelete() {
    await deleteCharacter(character!.id)
    navigate(`/worlds/${worldId}/characters`)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="Back to characters" className="h-8 w-8" onClick={() => navigate(`/worlds/${worldId}/characters`)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        {/* Portrait */}
        <div className="relative">
          <PortraitImage
            imageId={character.portraitImageId}
            alt={character.name}
            className="h-12 w-12 rounded-full object-cover"
            fallbackClassName="h-12 w-12 rounded-full"
            zoomable
          />
          {/*
            CH-5: two 12px icons sat 2px apart in a pill on the bottom edge of a
            48px avatar. Enlarging them in place was not available — `.pw-tap`
            only works on well-spaced standalone controls, since two adjacent
            ones would give overlapping 44px hit areas — so the pair is the
            problem, not their size. One menu trigger instead, the same one the
            review settled on for TL-3, EV-5, CH-4 and LORE-1, which carries
            `.pw-tap` and a name of its own.
          */}
          {!gate.active && (
            <div className="absolute -bottom-1.5 -right-1.5 rounded-full bg-[hsl(var(--accent))]">
              <Menu
                label={`Portrait for ${character.name}`}
                triggerClassName="h-6 w-6 rounded-full"
              >
                <MenuItem icon={Upload} label="Upload an image" onClick={() => portraitFileRef.current?.click()} />
                <MenuItem icon={Link2} label="Link by URL" onClick={() => setPortraitLinkOpen(true)} />
              </Menu>
              <input
                ref={portraitFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Upload portrait image"
                onChange={handlePortraitUpload}
              />
              {worldId && (
                <LinkImageButton
                  worldId={worldId}
                  onLinked={(blobId) => updateCharacter(character!.id, { portraitImageId: blobId })}
                  controlledOpen={portraitLinkOpen}
                  onOpenChange={setPortraitLinkOpen}
                />
              )}
            </div>
          )}
        </div>

        <div>
          {/* The identity block: portrait, name, aliases, and nothing repeated
              below (CH-2). The aliases were a bare list under the name, which
              reads as a second name rather than as other names. */}
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">{character.name}</h2>
          {character.aliases.length > 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Also known as {character.aliases.join(', ')}
            </p>
          )}
        </div>

        {/* CH-4: delete was the only icon in this header, top right, drawn like
            any other — the most destructive act on the screen with nothing
            implying weight. See `src/components/ui/menu.tsx`. */}
        {!gate.active && (
          <Menu label={`More actions for ${character.name}`} className="ml-auto" triggerClassName="h-8 w-8">
            <MenuItem icon={Trash2} label="Delete character" danger onClick={() => setConfirmOpen(true)} />
          </Menu>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${character.name}"?`}
        description="This will permanently remove the character and all their snapshots."
        onConfirm={handleDelete}
      />

      {/* Tabs */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs value={tab} onValueChange={selectTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="state">Current State</TabsTrigger>
            <TabsTrigger value="history">History<TabCount n={snapshots.length} /></TabsTrigger>
            <TabsTrigger value="appearances">Appearances<TabCount n={appearanceCount} /></TabsTrigger>
            <TabsTrigger value="goals">Goals<TabCount n={goals.length} /></TabsTrigger>
            <TabsTrigger value="relationships">Relationships<TabCount n={relationships.length} /></TabsTrigger>
            <TabsTrigger value="lore">Lore<TabCount n={lorePages.length} /></TabsTrigger>
            <TabsTrigger value="factions">Factions<TabCount n={memberships.length} /></TabsTrigger>
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
          <TabsContent value="appearances">
            <AppearancesTab character={character} />
          </TabsContent>
          <TabsContent value="goals">
            <GoalsTab character={character} />
          </TabsContent>
          <TabsContent value="relationships">
            <RelationshipsTab character={character} />
          </TabsContent>
          <TabsContent value="lore">
            <RelatedLoreSection worldId={worldId ?? ''} entityId={character.id} entityName={character.name} />
          </TabsContent>
          <TabsContent value="factions">
            <FactionsTab character={character} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
