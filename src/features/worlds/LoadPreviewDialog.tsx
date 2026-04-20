import { GitMerge, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MergePreview, WorldExportFile } from './cloudSyncHelpers'

interface Props {
  preview: MergePreview
  parsed: WorldExportFile
  onReplace: (parsed: WorldExportFile) => void
  onMerge:   (parsed: WorldExportFile) => void
  onCancel:  () => void
  isApplying: boolean
}

interface StatRowProps { label: string; added: number; updated: number }

function StatRow({ label, added, updated }: StatRowProps) {
  if (added === 0 && updated === 0) return null
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="flex gap-2">
        {added   > 0 && <span className="text-green-500">+{added} new</span>}
        {updated > 0 && <span className="text-amber-500">~{updated} updated</span>}
      </span>
    </div>
  )
}

export function LoadPreviewDialog({ preview, parsed, onReplace, onMerge, onCancel, isApplying }: Props) {
  const hasChanges =
    preview.characters.added + preview.characters.updated +
    preview.events.added     + preview.events.updated     +
    preview.chapters.added   + preview.chapters.updated   +
    preview.locations.added  + preview.locations.updated  +
    preview.items.added      + preview.items.updated > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5 shadow-xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Load from folder</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Saved {new Date(preview.exportedAt).toLocaleString()}
          </p>
        </div>

        {hasChanges ? (
          <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3 space-y-1.5">
            <p className="text-xs font-medium mb-2">Changes detected vs. your local version:</p>
            <StatRow label="Characters" {...preview.characters} />
            <StatRow label="Events"     {...preview.events}     />
            <StatRow label="Chapters"   {...preview.chapters}   />
            <StatRow label="Locations"  {...preview.locations}  />
            <StatRow label="Items"      {...preview.items}      />
          </div>
        ) : (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            No differences detected in the main entities.
          </p>
        )}

        <div className="space-y-2">
          <Button
            size="sm" className="w-full gap-2"
            onClick={() => onMerge(parsed)}
            disabled={isApplying}
          >
            {isApplying
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <GitMerge className="h-3.5 w-3.5" />}
            Smart merge
          </Button>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center px-2">
            Keeps your newer local edits. Pulls in remote additions and newer remote changes.
          </p>
        </div>

        <div className="flex gap-2 pt-1 border-t border-[hsl(var(--border))]">
          <Button
            size="sm" variant="destructive" className="flex-1"
            onClick={() => onReplace(parsed)}
            disabled={isApplying}
          >
            Replace all
          </Button>
          <Button
            size="sm" variant="ghost" className="flex-1"
            onClick={onCancel}
            disabled={isApplying}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
