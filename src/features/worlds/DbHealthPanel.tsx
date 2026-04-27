import { useState, useCallback } from 'react'
import { ShieldCheck, Trash2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { scanOrphans, purgeOrphans, totalOrphans, type OrphanReport } from '@/db/hooks/useDbHealth'

const ORPHAN_LABELS: Record<keyof OrphanReport, string> = {
  characterSnapshots:   'Character snapshots',
  locationSnapshots:    'Location snapshots',
  itemSnapshots:        'Item snapshots',
  relationshipSnapshots:'Relationship snapshots',
  itemPlacements:       'Item placements',
  characterMovements:   'Character movements',
  mapRegionSnapshots:   'Map region snapshots',
  factionMemberships:   'Faction memberships',
}

interface Props {
  worldId: string
}

export function DbHealthPanel({ worldId }: Props) {
  const [report, setReport] = useState<OrphanReport | null>(null)
  const [scanning, setScanning] = useState(false)
  const [purging, setPurging] = useState(false)
  const [justCleaned, setJustCleaned] = useState(false)

  const handleScan = useCallback(async () => {
    setScanning(true)
    setJustCleaned(false)
    try {
      const result = await scanOrphans(worldId)
      setReport(result)
    } finally {
      setScanning(false)
    }
  }, [worldId])

  const handlePurge = useCallback(async () => {
    if (!report) return
    setPurging(true)
    try {
      await purgeOrphans(worldId)
      setReport(null)
      setJustCleaned(true)
    } finally {
      setPurging(false)
    }
  }, [worldId, report])

  const total = report ? totalOrphans(report) : 0
  const affectedTypes = report
    ? (Object.keys(report) as (keyof OrphanReport)[]).filter((k) => report[k] > 0)
    : []

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          DB Health
        </h2>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Scan for snapshot or membership records whose parent entity (event, character, item, etc.) has been deleted.
          Orphaned records can cause ghost entries in the continuity checker.
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleScan}
        disabled={scanning || purging}
      >
        {scanning
          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          : <ShieldCheck className="h-3.5 w-3.5" />
        }
        {scanning ? 'Scanning…' : 'Scan for orphans'}
      </Button>

      {justCleaned && !report && (
        <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
          All orphaned records cleaned up.
        </div>
      )}

      {report && total === 0 && (
        <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
          No orphaned records found. Database is healthy.
        </div>
      )}

      {report && total > 0 && (
        <div className="space-y-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--foreground))]">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            Found {total} orphaned record{total !== 1 ? 's' : ''} across {affectedTypes.length} table{affectedTypes.length !== 1 ? 's' : ''}
          </div>

          <ul className="space-y-1">
            {affectedTypes.map((key) => (
              <li key={key} className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                <span>{ORPHAN_LABELS[key]}</span>
                <span className="font-medium tabular-nums text-[hsl(var(--foreground))]">{report[key]}</span>
              </li>
            ))}
          </ul>

          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={handlePurge}
            disabled={purging}
          >
            {purging
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />
            }
            {purging ? 'Cleaning up…' : `Clean up ${total} orphaned record${total !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </section>
  )
}
