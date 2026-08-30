import { useMemo } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { deleteSnapshot } from '@/db/hooks/useSnapshots'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { describeWithdrawal, withdrawalOutcome } from '@/lib/snapshotWithdrawal'
import type { CharacterSnapshot } from '@/types'

/**
 * Take back one recorded state.
 *
 * `deleteSnapshot` has existed and been tested since the data layer was
 * written, and nothing in the app called it: a writer could assert where a
 * character stood at a scene and had no way to say they had not meant it. The
 * dialog says what the withdrawal does to the scenes after it before doing it —
 * see `withdrawalOutcome`.
 */
export function WithdrawSnapshotDialog({
  open,
  onOpenChange,
  characterName,
  worldId,
  snapshots,
  snapshotId,
  onWithdrawn,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  characterName: string
  worldId: string
  /** Every snapshot this character has — the set the fallback is resolved from. */
  snapshots: CharacterSnapshot[]
  snapshotId: string | null
  onWithdrawn?: () => void
}) {
  const events = useWorldEvents(worldId)
  const chapters = useWorldChapters(worldId)

  const { fallbackLabel, followers } = useMemo(() => {
    if (!snapshotId || !open) return { fallbackLabel: null, followers: 0 }
    const outcome = withdrawalOutcome(snapshots, snapshotId, events, chapters)
    if (!outcome.fallback) return { fallbackLabel: null, followers: outcome.followers }
    const ev = events.find((e) => e.id === outcome.fallback!.eventId)
    const ch = chapters.find((c) => c.id === ev?.chapterId)
    const label = ch
      ? `Ch. ${ch.number}${ev?.title ? ` · ${ev.title}` : ` — ${ch.title}`}`
      : 'an earlier scene'
    return { fallbackLabel: label, followers: outcome.followers }
  }, [snapshotId, open, snapshots, events, chapters])

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Remove this recorded state?"
      description={describeWithdrawal(characterName, fallbackLabel, followers)}
      confirmLabel="Remove record"
      onConfirm={() => {
        if (!snapshotId) return
        void deleteSnapshot(snapshotId).then(() => onWithdrawn?.())
      }}
    />
  )
}
