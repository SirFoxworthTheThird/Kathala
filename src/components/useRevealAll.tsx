import { useState, type ReactElement } from 'react'
import { useAppStore } from '@/store'
import { useWorld } from '@/db/hooks/useWorlds'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { revealAllAction } from '@/lib/revealAll'

/**
 * Clearing the time cursor — which, while reading, reveals the whole book.
 *
 * There are two controls that do this and they had drifted apart. The top bar's
 * ✕ asked first, through `revealAllAction`; the bottom bar's ✕ called
 * `setActiveEventId(null)` directly, ungated and unconfirmed. A blind reader run
 * found the second one: 16×16 CSS px, in the phone thumb zone, sitting beside a
 * collapse chevron so it reads as "close this bar", and one tap took a reader at
 * chapter 7 of *Dracula* from 14 characters to 25, 21 map markers to 60, and
 * removed "Chapter 7 of 27" from their shelf. No dialog, and no way back —
 * nothing tracks how far they had read.
 *
 * So the guard is a hook rather than a rule to remember. A caller cannot reach
 * the unguarded path any more, because there is no longer an unguarded path to
 * reach: `requestClear` decides, and the dialog it needs comes back with it.
 *
 * `revealAllAction` keeps the three-way decision — including `wait`, which
 * exists because the gate reports itself inactive while Dexie is opening and a
 * click landing in that window would otherwise take the writing path.
 */
export function useRevealAll(worldId: string | null): {
  requestClear: () => void
  revealAllDialog: ReactElement
} {
  const setActiveEventId = useAppStore((s) => s.setActiveEventId)
  // `null` while no world is active: `useWorld` gives back `undefined`, which
  // `revealAllAction` reads as "not loaded yet" and declines to act on. That is
  // the right answer — clearing a cursor in a world that is not open is not a
  // thing anyone meant to do.
  const world = useWorld(worldId)
  const gate = useGate()
  const [confirming, setConfirming] = useState(false)

  return {
    requestClear: () => {
      const action = revealAllAction({ worldLoaded: world !== undefined, gateActive: gate.active })
      if (action === 'confirm') setConfirming(true)
      else if (action === 'clear') setActiveEventId(null)
    },
    revealAllDialog: (
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Show the whole book?"
        description="Viewing all chapters drops back to the full world — every character, place and subplot, including the ones the story has not introduced yet. Step the cursor instead to keep reading spoiler-free."
        confirmLabel="Show everything"
        destructive={false}
        onConfirm={() => setActiveEventId(null)}
      />
    ),
  }
}
