/** What pressing "View all chapters" should do. */
export type RevealAllAction =
  /** The world is not loaded yet — decide nothing. */
  | 'wait'
  /** Reading mode is on: ask before discarding the reading position. */
  | 'confirm'
  /** Writing: drop straight back to the whole world. */
  | 'clear'

/**
 * Whether the reader is asked before the whole book is revealed.
 *
 * The gate reports `active: false` in two very different situations: when the
 * world is being written, and when Dexie has not opened yet — `OPEN_GATE` is
 * documented as "a gate that hides nothing, used while data is loading". The
 * control read only that flag, so a click landing before the world resolved
 * took the writing path and cleared the cursor outright. On a reading-mode
 * world that silently discards the reading position and reveals every
 * character, place and subplot the story has not introduced, which is the exact
 * thing the confirm exists to prevent.
 *
 * It surfaced as a flaky test rather than a bug report, which is the only
 * reason it was found: the spec clicks the control on a freshly downloaded
 * library world, and on a loaded machine the click sometimes won that race. The
 * router's `WritersOnly` guard already treats an unloaded world as "wait rather
 * than guess"; this is the same rule for the same reason.
 */
export function revealAllAction(state: {
  /** False while the world record is still `undefined`. */
  worldLoaded: boolean
  /** Whether reveal gating applies — only meaningful once loaded. */
  gateActive: boolean
}): RevealAllAction {
  if (!state.worldLoaded) return 'wait'
  return state.gateActive ? 'confirm' : 'clear'
}
