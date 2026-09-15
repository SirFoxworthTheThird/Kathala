import { useState, type ReactElement } from 'react'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { asksBeforeJumping } from '@/lib/readingAhead'

/**
 * Moving the cursor somewhere the reader has not read to, which asks first.
 *
 * This lived inside `ChapterTimelineBar` as local state and a local dialog, and
 * so covered only the bar. A blind reader run found the other door: every one of
 * the 117 chapter rows on the Timeline carries a **Read to here** button, on the
 * screen the dashboard's *Set where you have read to* points at, and one click
 * on a far chapter moved a reader from chapter 3 to chapter 38 with no dialog at
 * all — while the identical action on the bar, thirty rows below, asked.
 *
 * `useRevealAll` learned this lesson first and wrote it down: "the guard is a
 * hook rather than a rule to remember". Its own note then claimed there was no
 * unguarded path left to reach, which was not true — `ChapterRow` called
 * `setActiveEventId` directly. Two guards, three doors; this is the second one
 * made into a hook so the count stops going up.
 *
 * `asksBeforeJumping` holds the rule about *when*: never for the next chapter,
 * which is ordinary reading, and never backwards, which only re-hides.
 */
export function useReadAhead(): {
  /** Run `go`, first confirming if it would read ahead. */
  guardJump: (toChapter: number | undefined, go: () => void) => void
  readAheadDialog: ReactElement
} {
  const gate = useGate()
  const [pending, setPending] = useState<{ to: number; go: () => void } | null>(null)

  return {
    guardJump: (toChapter, go) => {
      if (toChapter === undefined || !gate.active || !asksBeforeJumping(gate.chapterNumber, toChapter)) {
        go()
        return
      }
      setPending({ to: toChapter, go })
    },
    /*
      The wording says what actually happens rather than warning of damage: the
      reveals are computed from the cursor, so moving back hides them again.
      What it cannot give back is not having seen them.
    */
    readAheadDialog: (
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => { if (!v) setPending(null) }}
        title={pending ? `Read ahead to chapter ${pending.to}?` : ''}
        description={
          gate.chapterNumber !== null && pending
            ? `You are on chapter ${gate.chapterNumber}. Moving there shows everything the story introduces in between — people, places and connections you have not met yet. Coming back hides them again.`
            : undefined
        }
        confirmLabel="Read ahead"
        onConfirm={() => { pending?.go(); setPending(null) }}
      />
    ),
  }
}
