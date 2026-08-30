import { Link, useParams } from 'react-router-dom'
import { Package } from 'lucide-react'
import type { Item } from '@/types'
import { PortraitImage } from '@/components/PortraitImage'
import { CONDITION_COLORS } from '@/lib/itemCondition'

export function ItemCard({ item, whereabouts, condition }: {
  item: Item
  /** Where it is at the cursor — null when there is no cursor to ask about. */
  whereabouts?: string | null
  /** Its condition at the cursor, when one has been recorded. */
  condition?: string | null
}) {
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
        {/*
          IT-2: the roster showed a type and a description, so with a cursor set
          you still could not see what was where — on the screen devoted to
          items, while the map sidebar had been answering it all along.
        */}
        {(whereabouts || condition) && (
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
            {condition && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: CONDITION_COLORS[condition] ?? CONDITION_COLORS.unknown }}
                title={`Condition: ${condition}`}
              />
            )}
            {condition && <span className="capitalize">{condition}</span>}
            {condition && whereabouts && <span aria-hidden="true">·</span>}
            {whereabouts && <span className="truncate">{whereabouts}</span>}
          </p>
        )}
      </div>
    </Link>
  )
}
