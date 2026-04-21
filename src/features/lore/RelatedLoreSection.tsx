import { useNavigate } from 'react-router-dom'
import { BookMarked } from 'lucide-react'
import { useLorePagesForEntity } from '@/db/hooks/useLore'

function relativeDate(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString()
}

interface Props {
  worldId: string
  entityId: string
  entityName: string
}

export function RelatedLoreSection({ worldId, entityId, entityName }: Props) {
  const navigate = useNavigate()
  const pages = useLorePagesForEntity(worldId, entityId)

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] px-6 py-8 text-center">
        <BookMarked className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">No lore linked to {entityName}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Open a lore page and use the link button to associate it with this entity.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {pages.map((page) => {
        const preview = page.body.slice(0, 100).replace(/[#*`_>\-]/g, '').trim()
        return (
          <button
            key={page.id}
            onClick={() => navigate(`/worlds/${worldId}/lore/${page.id}`)}
            className="group flex flex-col gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-left hover:border-[hsl(var(--ring)/0.4)] transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{page.title}</span>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{relativeDate(page.updatedAt)}</span>
            </div>
            {preview && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 leading-relaxed">{preview}</p>
            )}
            {page.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {page.tags.slice(0, 4).map((t) => (
                  <span key={t} className="rounded bg-[hsl(var(--border))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{t}</span>
                ))}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
