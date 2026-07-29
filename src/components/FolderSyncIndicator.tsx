import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CloudOff, RefreshCw, AlertTriangle, FolderSync } from 'lucide-react'
import { loadFolderBinding, checkPermission, type FolderBinding } from '@/lib/folderSync'
import { readFolderSyncState } from '@/features/worlds/folderSyncRunner'
import { FOLDER_SYNC_LABELS, type FolderSyncState } from '@/lib/folderSyncState'
import { cn } from '@/lib/utils'

/**
 * Where the bound folder stands, shown next to the world name.
 *
 * Sync status belongs where the author is working, not behind a Settings tab
 * they have no reason to open mid-scene. Without this, a paused or conflicted
 * auto-save is indistinguishable from a working one — which is the failure this
 * exists to prevent.
 *
 * Renders nothing at all when the world has no folder binding, so it stays out
 * of the way for everyone not using folder sync.
 */

const POLL_MS = 20_000

type Display = FolderSyncState | 'no-permission'

const ICONS: Record<Display, typeof Check> = {
  'never-synced': FolderSync,
  'in-sync': Check,
  'local-ahead': RefreshCw,
  'remote-ahead': AlertTriangle,
  conflict: AlertTriangle,
  'no-permission': CloudOff,
}

const TONE: Record<Display, string> = {
  'never-synced': 'text-[hsl(var(--muted-foreground))]',
  'in-sync': 'text-[hsl(var(--muted-foreground))]',
  'local-ahead': 'text-[hsl(var(--muted-foreground))]',
  'remote-ahead': 'text-amber-400',
  conflict: 'text-amber-400',
  'no-permission': 'text-amber-400',
}

const SHORT: Record<Display, string> = {
  'never-synced': 'Not saved',
  'in-sync': 'Saved',
  'local-ahead': 'Saving…',
  'remote-ahead': 'Folder newer',
  conflict: 'Conflict copy',
  'no-permission': 'Reconnect folder',
}

export function FolderSyncIndicator({ worldId }: { worldId: string }) {
  const navigate = useNavigate()
  const [binding, setBinding] = useState<FolderBinding | null>(null)
  const [display, setDisplay] = useState<Display | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const b = await loadFolderBinding(worldId)
      if (cancelled) return
      setBinding(b)
      if (!b) { setDisplay(null); return }
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
    const timer = setInterval(check, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [worldId])

  if (!binding || !display) return null

  const Icon = ICONS[display]
  const detail =
    display === 'no-permission'
      ? 'PlotWeave has lost access to the sync folder. Open World Settings to reconnect it.'
      : FOLDER_SYNC_LABELS[display].detail

  return (
    <button
      onClick={() => navigate(`/worlds/${worldId}/settings`)}
      aria-label={`Folder sync: ${SHORT[display]}`}
      title={detail}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] transition-colors hover:bg-[hsl(var(--accent))]',
        TONE[display],
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', display === 'local-ahead' && 'animate-spin')} aria-hidden="true" />
      <span className="hidden xl:inline">{SHORT[display]}</span>
    </button>
  )
}
