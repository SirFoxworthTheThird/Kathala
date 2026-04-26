import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Package } from 'lucide-react'
import { useItems } from '@/db/hooks/useItems'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/EmptyState'
import { ItemCard } from './ItemCard'
import { CreateItemDialog } from './CreateItemDialog'

export default function ItemRosterView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const items = useItems(worldId ?? null)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
        <Input
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs text-sm"
        />
        <Button size="sm" className="ml-auto" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

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
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {worldId && (
        <CreateItemDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          worldId={worldId}
          onCreated={(id) => navigate(`/worlds/${worldId}/items/${id}`)}
        />
      )}
    </div>
  )
}
