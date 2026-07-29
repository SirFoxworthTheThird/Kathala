import { useEffect } from 'react'
import { onDeletion } from '@/db/hooks/useOperations'
import { ENTITY_LABEL } from '@/lib/entityTables'
import { useAppStore } from '@/store'
import { useUndoAction } from './useUndo'

/** Stable id, so a run of deletions replaces one toast instead of stacking. */
const DELETE_TOAST_ID = 'undo-delete'

/**
 * Offers an undo when something is deleted.
 *
 * Deletions get a toast and ordinary edits don't, because an edit's result is
 * already visible on screen — a "saved" toast for every rename would be noise
 * fired constantly. A deletion removes the thing the user was looking at, so
 * the way back has to come to them rather than waiting to be found.
 */
export function UndoToastBridge({ worldId }: { worldId: string | null }) {
  const pushToast = useAppStore((s) => s.pushToast)
  const undo = useUndoAction(worldId)

  useEffect(() => {
    return onDeletion((notice) => {
      if (notice.worldId !== worldId) return
      const name = typeof notice.payload.name === 'string' ? notice.payload.name.trim() : ''
      const label = ENTITY_LABEL[notice.entityType] ?? 'record'
      const message = notice.count > 1
        ? `Deleted ${notice.count} ${label}s`
        : name
          ? `Deleted ${label} “${name}”`
          : `Deleted ${label}`
      pushToast({ id: DELETE_TOAST_ID, message, actionLabel: 'Undo', onAction: () => { void undo() } })
    })
  }, [worldId, pushToast, undo])

  return null
}
