import { useCallback, useMemo } from 'react'
import {
  redoLast,
  resolveSubjects,
  undoLast,
  useOperationSubjects,
  useRedoHead,
  useUndoHead,
  useUndoStack,
} from '@/db/hooks/useOperations'
import { describeInverse, describeOperation } from '@/lib/operations'
import { useAppStore } from '@/store'
import type { Operation } from '@/types/operation'

/**
 * The undo action on its own, with no subscription to the journal.
 *
 * Split out from `useUndo` because the keyboard shortcut and the delete toast
 * only ever need to *perform* an undo. Mounting the live query for them too
 * meant a whole-table read re-running on every single write, three times over,
 * for two callers that never look at the result.
 */
export function useUndoAction(worldId: string | null) {
  const pushToast = useAppStore((s) => s.pushToast)

  return useCallback(async () => {
    if (!worldId) return
    const undone = await undoLast(worldId)
    if (undone.length === 0) {
      pushToast({ message: 'Nothing to undo' })
      return
    }
    // Named after the fact, not before: undoing an update leaves the record in
    // place, and an update is the only kind whose payload cannot name itself.
    const subjects = await resolveSubjects(undone)
    pushToast({
      message: undone.length > 1
        ? `Undid ${undone.length} changes`
        : `Undid: ${describeOperation(undone[0], subjects.get(undone[0].id))}`,
    })
  }, [worldId, pushToast])
}

/** The redo action, likewise without subscribing to the journal. */
export function useRedoAction(worldId: string | null) {
  const pushToast = useAppStore((s) => s.pushToast)

  return useCallback(async () => {
    if (!worldId) return
    const redone = await redoLast(worldId)
    if (redone.length === 0) {
      pushToast({ message: 'Nothing to redo' })
      return
    }
    const subjects = await resolveSubjects(redone)
    pushToast({
      message: redone.length > 1
        ? `Redid ${redone.length} changes`
        : `Redid: ${describeInverse(redone[0], subjects.get(redone[0].id))}`,
    })
  }, [worldId, pushToast])
}

/**
 * Undo and redo, plus what each would do — for the toolbar buttons, which need
 * a label and a disabled state but never the rest of the history.
 */
export function useUndoNext(worldId: string | null) {
  const head = useUndoHead(worldId)
  const redoHead = useRedoHead(worldId)
  const undo = useUndoAction(worldId)
  const redo = useRedoAction(worldId)
  const heads = useMemo(
    () => [head, redoHead].filter((op): op is Operation => !!op),
    [head, redoHead],
  )
  const subjects = useOperationSubjects(heads)

  return {
    undo,
    redo,
    canUndo: !!head,
    /** Empty right after a bulk import, which resets the journal. */
    nextLabel: head ? describeOperation(head, subjects.get(head.id)) : null,
    canRedo: !!redoHead,
    // The head is the *undo*, so describing it plainly would say the opposite
    // of what redo is about to do.
    redoLabel: redoHead ? describeInverse(redoHead, subjects.get(redoHead.id)) : null,
  }
}

/** Undo plus the recent history, for the panel that lists it. */
export function useUndo(worldId: string | null) {
  const stack = useUndoStack(worldId, 30)
  const undo = useUndoAction(worldId)
  /** What each entry is about — see `resolveSubjects`. Absent means unnamed. */
  const subjects = useOperationSubjects(stack)

  return {
    undo,
    /** Newest first. Empty right after a bulk import, which resets the journal. */
    stack,
    subjects,
    canUndo: stack.length > 0,
    nextLabel: stack[0] ? describeOperation(stack[0], subjects.get(stack[0].id)) : null,
  }
}
