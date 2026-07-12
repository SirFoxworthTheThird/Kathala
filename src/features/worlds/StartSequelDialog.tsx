import { useEffect, useMemo, useState } from 'react'
import { BookCopy, Users, Package, Shield, Map as MapIcon } from 'lucide-react'
import type { World } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { useFactions } from '@/db/hooks/useFactions'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { createSequelWorld } from '@/db/hooks/useSequel'

interface StartSequelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  world: World
  onCreated?: (worldId: string) => void
}

/**
 * A checklist of carry-over candidates. Selection is tracked as the *deselected*
 * set so the default is "carry everything" — robust to the roster loading
 * asynchronously after the dialog opens.
 */
function CheckSection<T extends { id: string; name: string }>({
  title, icon: Icon, entities, deselected, onToggle, onAll,
}: {
  title: string
  icon: React.ElementType
  entities: T[]
  deselected: Set<string>
  onToggle: (id: string) => void
  onAll: (all: boolean) => void
}) {
  if (entities.length === 0) return null
  const selectedCount = entities.filter((e) => !deselected.has(e.id)).length
  const allOn = selectedCount === entities.length
  return (
    <div className="rounded-md border border-[hsl(var(--border))]">
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2">
        <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{title}</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{selectedCount}/{entities.length}</span>
        <button type="button" onClick={() => onAll(!allOn)} className="ml-auto text-[11px] text-[hsl(var(--ring))] hover:underline">
          {allOn ? 'Clear' : 'Select all'}
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto p-1.5">
        {entities.map((e) => (
          <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-[hsl(var(--accent))]">
            <input type="checkbox" checked={!deselected.has(e.id)} onChange={() => onToggle(e.id)} className="accent-[hsl(var(--ring))]" />
            <span className="truncate">{e.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function StartSequelDialog({ open, onOpenChange, world, onCreated }: StartSequelDialogProps) {
  const characters = useCharacters(open ? world.id : null)
  const items = useItems(open ? world.id : null)
  const factions = useFactions(open ? world.id : null)
  const mapLayers = useMapLayers(open ? world.id : null)

  const [name, setName] = useState('')
  const [deChars, setDeChars] = useState<Set<string>>(new Set())
  const [deItems, setDeItems] = useState<Set<string>>(new Set())
  const [deFactions, setDeFactions] = useState<Set<string>>(new Set())
  const [deMaps, setDeMaps] = useState<Set<string>>(new Set())
  const [seedOpening, setSeedOpening] = useState(true)
  const [convertLore, setConvertLore] = useState(true)
  const [carryLore, setCarryLore] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset to "carry everything" each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setName(`${world.name} — Book 2`)
    setDeChars(new Set()); setDeItems(new Set()); setDeFactions(new Set()); setDeMaps(new Set())
    setError(null)
  }, [open, world.name])

  const toggler = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    set((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allSetter = <T extends { id: string }>(set: React.Dispatch<React.SetStateAction<Set<string>>>, entities: T[]) => (all: boolean) =>
    set(all ? new Set() : new Set(entities.map((e) => e.id)))

  const selectedIds = <T extends { id: string }>(entities: T[], de: Set<string>) => entities.filter((e) => !de.has(e.id)).map((e) => e.id)

  const total = useMemo(
    () => selectedIds(characters, deChars).length + selectedIds(items, deItems).length + selectedIds(factions, deFactions).length + selectedIds(mapLayers, deMaps).length,
    [characters, deChars, items, deItems, factions, deFactions, mapLayers, deMaps],
  )

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const worldId = await createSequelWorld(
        world.id,
        {
          characterIds: selectedIds(characters, deChars),
          itemIds: selectedIds(items, deItems),
          factionIds: selectedIds(factions, deFactions),
          mapLayerIds: selectedIds(mapLayers, deMaps),
        },
        { name, seedOpeningChapter: seedOpening, convertStoryToLore: convertLore, carryWorldbuildingLore: carryLore },
      )
      onOpenChange(false)
      onCreated?.(worldId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the sequel')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-y-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-[hsl(var(--border))] px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <BookCopy className="h-4 w-4 text-[hsl(var(--ring))]" />
            Start a sequel
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Create a new book from <span className="font-medium text-[hsl(var(--foreground))]">{world.name}</span>. Pick what carries over —
            relationships continue from where they ended, and the previous story can become reference lore. The new book is a copy; editing it
            won't change the original.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sequel-name">New book name</Label>
            <Input id="sequel-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <CheckSection title="Characters" icon={Users} entities={characters} deselected={deChars} onToggle={toggler(setDeChars)} onAll={allSetter(setDeChars, characters)} />
          <CheckSection title="Factions" icon={Shield} entities={factions} deselected={deFactions} onToggle={toggler(setDeFactions)} onAll={allSetter(setDeFactions, factions)} />
          <CheckSection title="Items" icon={Package} entities={items} deselected={deItems} onToggle={toggler(setDeItems)} onAll={allSetter(setDeItems, items)} />
          <CheckSection title="Maps" icon={MapIcon} entities={mapLayers} deselected={deMaps} onToggle={toggler(setDeMaps)} onAll={allSetter(setDeMaps, mapLayers)} />

          <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3">
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input type="checkbox" checked={seedOpening} onChange={(e) => setSeedOpening(e.target.checked)} className="mt-0.5 accent-[hsl(var(--ring))]" />
              <span><span className="font-medium text-[hsl(var(--foreground))]">Seed an opening chapter</span> — start book 2 with each character at their book-1 ending state.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input type="checkbox" checked={convertLore} onChange={(e) => setConvertLore(e.target.checked)} className="mt-0.5 accent-[hsl(var(--ring))]" />
              <span><span className="font-medium text-[hsl(var(--foreground))]">Turn the story into “Previously…” lore</span> — one recap page per book-1 chapter.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input type="checkbox" checked={carryLore} onChange={(e) => setCarryLore(e.target.checked)} className="mt-0.5 accent-[hsl(var(--ring))]" />
              <span><span className="font-medium text-[hsl(var(--foreground))]">Carry world-building lore</span> — bring the existing lore pages forward.</span>
            </label>
          </div>

          {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
        </div>

        <DialogFooter className="shrink-0 border-t border-[hsl(var(--border))] px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            <BookCopy className="h-4 w-4" />
            {creating ? 'Creating…' : `Create sequel${total > 0 ? ` (${total} carried)` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
