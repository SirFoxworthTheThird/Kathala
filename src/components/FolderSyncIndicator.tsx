import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CloudOff, RefreshCw, AlertTriangle, FolderSync } from 'lucide-react'
import { loadFolderBinding, checkPermission, isFolderSyncSupported, type FolderBinding } from '@/lib/folderSync'
import { readFolderSyncState } from '@/features/worlds/folderSyncRunner'
import { backupSummary, type BackupState } from '@/lib/backupStanding'
import { cn } from '@/lib/utils'

/**
 * Where the only copy of this world stands, shown next to its name.
 *
 * Backup status belongs where the author is working, not behind a Settings tab
 * they have no reason to open mid-scene. Without this, a paused or conflicted
 * auto-save is indistinguishable from a working one.
 *
 * **It used to render nothing when no folder was bound**, on the reasoning that
 * it should stay out of the way of everyone not using the feature. That put the
 * writer most at risk — the one who has never heard of it, whose novel exists
 * in one browser's IndexedDB and nowhere else — in the group told nothing at
 * all. Silence there is indistinguishable from *you are safe*.
 *
 * So an unbacked world says so, quietly and in muted grey, and the chip is one
 * click from the panel that fixes it.
 *
 * **Nor does a browser without the folder picker get nothing.** That was the
 * first version of this fix and it repeated the mistake one group along: Brave
 * blocks the File System Access API with no flag to re-enable it, and no
 * Chromium on Android exposes it, so the writers with the *fewest* routes to a
 * second copy were the ones told least about it. They are not out of options —
 * a `.pwk` export works everywhere — so they get the same sentence and a
 * different remedy.
 */

const POLL_MS = 20_000

type Display = BackupState

const ICONS: Record<Display, typeof Check> = {
  unbacked: CloudOff,
  unsupported: CloudOff,
  'never-synced': FolderSync,
  'in-sync': Check,
  'local-ahead': RefreshCw,
  'remote-ahead': AlertTriangle,
  conflict: AlertTriangle,
  'no-permission': CloudOff,
}

export function FolderSyncIndicator({ worldId }: { worldId: string }) {
  const navigate = useNavigate()
  const [binding, setBinding] = useState<FolderBinding | null>(null)
  const [display, setDisplay] = useState<Display | null>(null)
  /*
    Ticked with the poll so "Backed up 4m ago" ages on screen rather than
    freezing at whatever it said when the check last ran.
  */
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false

    async function check() {
      const b = await loadFolderBinding(worldId)
      if (cancelled) return
      setBinding(b)
      // No folder yet — and whether one can be chosen at all changes only the
      // advice, not the standing.
      if (!b) { setDisplay(isFolderSyncSupported() ? 'unbacked' : 'unsupported'); return }
      // Permission can lapse between sessions; auto-save is silently a no-op
      // until it is re-granted, so that has to be visible too.
      if (!(await checkPermission(b.handle))) {
        if (!cancelled) setDisplay('no-permission')
        return
      }
      try {
        const { state } = await readFolderSyncState(worldId, b)
        if (!cancelled) setDisplay(state)
      } catch {
        if (!cancelled) setDisplay(null)
      }
    }

    check()
    const timer = setInterval(() => { setNow(Date.now()); void check() }, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [worldId])

  if (!display) return null

  const Icon = ICONS[display]
  const { short, detail, tone } = backupSummary({ state: display, lastSyncedAt: binding?.lastSyncedAt, now })

  return (
    <button
      onClick={() => navigate(`/worlds/${worldId}/settings`)}
      aria-label={`Backup: ${short}`}
      title={detail}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] transition-colors hover:bg-[hsl(var(--accent))]',
        tone === 'warn' ? 'text-amber-400' : 'text-[hsl(var(--muted-foreground))]',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', display === 'local-ahead' && 'animate-spin')} aria-hidden="true" />
      <span className="hidden xl:inline">{short}</span>
    </button>
  )
}
