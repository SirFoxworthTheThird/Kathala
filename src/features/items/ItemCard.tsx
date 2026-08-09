import { Link, useParams } from 'react-router-dom'
import { Package } from 'lucide-react'
import type { Item } from '@/types'
import { PortraitImage } from '@/components/PortraitImage'

export function ItemCard({ item }: { item: Item }) {
  const { worldId } = useParams<{ worldId: string }>()

  // A Link, not a div with a click handler: the card *is* a way to that item's
  // page, so it should be reachable by Tab, openable with Enter, and able to go
  // to a new tab on middle-click like any other link in the app.
  return (
    <Link
      to={`/worlds/${worldId}/items/${item.id}`}
      className="group flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]"
    >
      <PortraitImage
        imageId={item.imageId}
        alt={item.name}
        className="h-12 w-12 rounded-md object-cover"
        fallbackClassName="h-12 w-12 rounded-md"
        fallbackIcon={Package}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[hsl(var(--foreground))]">{item.name}</p>
        {item.iconType && (
          <p className="text-xs capitalize text-[hsl(var(--muted-foreground))]">{item.iconType}</p>
        )}
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">{item.description}</p>
        )}
      </div>
    </Link>
  )
}
