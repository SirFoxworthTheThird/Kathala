import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Package, Sparkles } from 'lucide-react'
import { useItems } from '@/db/hooks/useItems'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { ItemCard } from './ItemCard'
import { CreateItemDialog } from './CreateItemDialog'
import { GenerateItemsDialog } from './GenerateItemsDialog'
import { resolveItemWhereabouts, describeWhereabouts } from '@/lib/itemWhereabouts'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useBestSnapshots } from '@/db/hooks/useSnapshots'
import { useEventItemPlacements } from '@/db/hooks/useItemPlacements'
import { useAppStore } from '@/store'
import { useBestItemSnapshots } from '@/db/hooks/useItemSnapshots'

export default function ItemRosterView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const items = useItems(worldId ?? null)
  const [search, setSearch] = useState('')

  /*
    IT-2: everything below is per-moment, so it is asked for once here rather
    than by each card — twenty cards each opening their own live query for the
    same three tables is the shape this screen would grow into otherwise.
  */
  const activeEventId = useAppStore((st) => st.activeEventId)
  const placements = useEventItemPlacements(activeEventId)
  const snapshots = useBestSnapshots(worldId ?? null, activeEventId)
  const markers = useAllLocationMarkers(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const itemSnapshots = useBestItemSnapshots(worldId ?? null, activeEventId)
  const conditionById = new Map(itemSnapshots.map((snap) => [snap.itemId, snap.condition]))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Package}
        title="Items"
        count={items.length}
        description="Objects characters carry, use, or lose over time."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAiOpen(true)}>
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>
        }
      >
        <Input
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs text-sm"
        />
      </PageHeader>

      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={items.length === 0 ? 'No items yet' : 'No matches'}
            description={items.length === 0 ? 'Track objects that characters carry, use, or lose over time.' : 'Try a different search.'}
            action={
              items.length === 0 ? (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                whereabouts={activeEventId ? describeWhereabouts(resolveItemWhereabouts({
                  itemId: item.id, placements, snapshots, markers, characters,
                })) : null}
                condition={activeEventId ? conditionById.get(item.id) ?? null : null}
              />
            ))}
          </div>
        )}
      </div>

      {worldId && (
        <>
          <CreateItemDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            worldId={worldId}
            onCreated={(id) => navigate(`/worlds/${worldId}/items/${id}`)}
          />
          <GenerateItemsDialog
            open={aiOpen}
            onOpenChange={setAiOpen}
            worldId={worldId}
          />
        </>
      )}
    </div>
  )
}
