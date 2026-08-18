import type { EventStatus } from '@/types'

export const EVENT_STATUSES: EventStatus[] = ['idea', 'outline', 'draft', 'revised', 'final']

/**
 * The five statuses are a **progression** — Idea to Final — so they are drawn
 * as a ramp rather than as five unrelated hues, and the ramp belongs to the
 * theme.
 *
 * They used to be five fixed hex values that looked much the same in all
 * sixteen themes, and read as no order at all: grey, blue, amber, violet,
 * green. Each theme now supplies the two ends and the stylesheet derives the
 * steps.
 *
 * **The ink is one colour for every pill in every theme, and that is a
 * guarantee rather than a hope.** Every step is drawn at the same saturation
 * and lightness, so the worst contrast against `--status-ink` is 5.67:1 at the
 * shipped values — and a theme may only *lower* the saturation, which raises
 * it. `themeDataColour.spec.ts` measures all five steps of all sixteen.
 */
export const EVENT_STATUS_CONFIG: Record<EventStatus, { label: string; color: string; textColor: string }> = {
  idea:    { label: 'Idea',    color: 'var(--status-1)', textColor: 'hsl(var(--status-ink))' },
  outline: { label: 'Outline', color: 'var(--status-2)', textColor: 'hsl(var(--status-ink))' },
  draft:   { label: 'Draft',   color: 'var(--status-3)', textColor: 'hsl(var(--status-ink))' },
  revised: { label: 'Revised', color: 'var(--status-4)', textColor: 'hsl(var(--status-ink))' },
  final:   { label: 'Final',   color: 'var(--status-5)', textColor: 'hsl(var(--status-ink))' },
}

/**
 * The display config for a status, for any value at all.
 *
 * `WorldEvent['status']` is typed as EventStatus, but nothing enforces that at
 * runtime: `validateImport` checks that arrays are arrays and never inspects a
 * single enum value, so a `.pwk` — hand-written, AI-generated, or produced by
 * an older build — can carry any string it likes. Indexing the record directly
 * then yields undefined, and the very next `.color` throws, which is a blank
 * screen rather than a mildly wrong badge.
 *
 * An unrecognised status is shown as itself in a neutral colour rather than
 * relabelled as one of the five. Quietly calling someone's "published" a
 * "Draft" would be a lie the user cannot see through.
 */
export function eventStatusConfig(status: unknown): { label: string; color: string; textColor: string } {
  // Membership is checked against the list, not with `in`: `'toString' in
  // EVENT_STATUS_CONFIG` is true through the prototype chain, and would hand
  // back a function to read `.label` off.
  if (typeof status === 'string' && (EVENT_STATUSES as readonly string[]).includes(status)) {
    return EVENT_STATUS_CONFIG[status as EventStatus]
  }
  const label = typeof status === 'string' && status.trim() ? status.trim() : 'Unknown'
  // Off the ramp on purpose: an unrecognised status is not a stage of one.
  return { label, color: 'hsl(var(--muted))', textColor: 'hsl(var(--muted-foreground))' }
}
