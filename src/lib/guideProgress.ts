/**
 * Where the first-run guide got to, kept across a reload.
 *
 * N14, from a blind writer run: the four-step guide held its progress in
 * component state, and the condition that summons it is "this world has no
 * timeline" — which **step 1 makes false**. So reloading between step 1 and
 * step 2 dropped the writer on the dashboard with steps 2 to 4 simply skipped,
 * and no way back in. The guide is the app's own answer to "what do I do
 * first", and a refresh ended it.
 *
 * Stored per world in `localStorage`, the way this app already keeps the
 * dismissed dashboard suggestions, the structure template and the manuscript
 * word goal. It is a note about where the writer is, not world data: it never
 * travels in `.pwk`, and losing it costs a resumed guide and nothing else.
 *
 * `'done'` is stored as well as progress, and that matters for the same reason:
 * "skip and explore on my own" was component state too, so on a world with no
 * timeline — which is every world the guide appears for — a reload after
 * skipping brought it straight back.
 */

export type GuideStep = 1 | 2 | 3 | 4

export interface GuideProgress {
  step: GuideStep
  createdEventId: string | null
  createdCharacterId: string | null
  createdEventTitle: string | null
  createdCharacterName: string | null
}

/** Progress, or the writer having finished or skipped it. */
export type StoredGuide = GuideProgress | 'done'

export function guideKey(worldId: string): string {
  return `plotweave-guide-${worldId}`
}

function isStep(v: unknown): v is GuideStep {
  return v === 1 || v === 2 || v === 3 || v === 4
}

function orNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/**
 * Read what was stored, or null when there is nothing usable there.
 *
 * Deliberately forgiving: this is a convenience note, and a writer whose
 * storage holds something unreadable — an older shape, a half-written value,
 * another tab's mess — should get the guide's ordinary behaviour rather than a
 * broken screen.
 */
export function readGuide(raw: string | null): StoredGuide | null {
  if (!raw) return null
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  if (parsed === 'done') return 'done'
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>
  if (!isStep(o.step)) return null
  return {
    step: o.step,
    createdEventId: orNull(o.createdEventId),
    createdCharacterId: orNull(o.createdCharacterId),
    createdEventTitle: orNull(o.createdEventTitle),
    createdCharacterName: orNull(o.createdCharacterName),
  }
}

/**
 * Whether anything has happened that is worth coming back to.
 *
 * Being *shown* the guide is not progress. The persisting effect runs on mount,
 * so without this the mere sight of step 1 was stored — and then a writer who
 * left the guide alone, went to the Timeline screen and built a timeline by
 * hand came back to the dashboard and was asked, at step 1 of 4, to name the
 * timeline they had just named. Three specs and a fourth intermittently caught
 * exactly that, having gone to the dashboard for something else entirely.
 *
 * Stepping back to 1 still counts, because by then step 1 has made its scene.
 */
export function hasGuideProgress(p: GuideProgress): boolean {
  return p.step > 1 || p.createdEventId !== null
}

/**
 * Whether to put the guide on screen.
 *
 * Stored progress wins over the world's shape, which is the finding: after step
 * 1 the world *has* a timeline, and asking "does it have one?" is then asking
 * the wrong question. Only a world nobody has started gets the guide unasked.
 */
export function shouldShowGuide(
  { stored, timelineCount }: { stored: StoredGuide | null; timelineCount: number | undefined },
): boolean {
  if (stored === 'done') return false
  if (stored) return true
  // `undefined` is "not counted yet" — showing the guide on that would flash it
  // at every world for as long as the query takes.
  return timelineCount === 0
}
