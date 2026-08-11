import type { Issue, IssueSeverity } from './computeIssues'

/**
 * What sort of fault an issue is, within its category (CC-3).
 *
 * A category was the only grouping there was, so *Items 79* was one heading
 * over a single repeated fault with the real findings buried inside it. The
 * category says which part of the world is involved; the kind says what went
 * wrong, and it is the kind that tells you whether a run of rows is one mistake
 * repeated or twenty separate ones.
 *
 * These names match the prefixes the issue ids already used, so a kind is read
 * off the issue rather than inferred from the wording of its message — which
 * would break the first time a message was reworded.
 */
export type IssueKind =
  // character
  | 'dead-then-alive' | 'orphan-snap' | 'dead-in-event' | 'char-before-intro'
  | 'stale-snapshot' | 'loc-destroyed' | 'char-in-region' | 'region-traversal'
  | 'travel-dist' | 'knowledge-anachronism' | 'dead-knower'
  // item
  | 'dup-item' | 'item-before-acquired' | 'item-after-destroyed-ev'
  | 'item-after-destroyed-inv' | 'item-handoff' | 'artifact-wrong-timeline'
  // relationship
  | 'rel-before-start' | 'dead-char-in-rel-snap'
  // faction
  | 'faction-gap' | 'hostile-loc'
  // pov
  | 'pov-not-involved' | 'dead-pov' | 'pov-consecutive'
  // prose
  | 'prose-dead' | 'prose-untagged' | 'prose-leak'
  // thread
  | 'thread-dangling' | 'thread-dormant' | 'thread-unstarted'

/**
 * What each kind is called when it heads a group.
 *
 * Written as the fault rather than as the check — "Alive after dying" rather
 * than "Death consistency" — because the heading has to be readable as a
 * summary of the rows underneath it.
 */
export const ISSUE_KIND_LABELS: Record<IssueKind, string> = {
  'dead-then-alive':       'Alive after dying',
  'orphan-snap':           'State recorded for a deleted scene',
  'dead-in-event':         'Dead character in a scene',
  'char-before-intro':     'Appears before any state was recorded',
  'stale-snapshot':        'State may be out of date',
  'loc-destroyed':         'At a destroyed place',
  'char-in-region':        'Inside a dangerous region',
  'region-traversal':      'Travels through a dangerous region',
  'travel-dist':           'Cannot travel that far in time',
  'knowledge-anachronism': 'Knows something too early',
  'dead-knower':           'Learns something after dying',
  'dup-item':              'Item in two places at once',
  'item-before-acquired':  'Item used before it was acquired',
  'item-after-destroyed-ev':  'Item used after being destroyed',
  'item-after-destroyed-inv': 'Destroyed item still carried',
  'item-handoff':          'Item changes hands across a distance',
  'artifact-wrong-timeline': 'Item outside its declared timelines',
  'rel-before-start':      'Relationship state before it began',
  'dead-char-in-rel-snap': 'Relationship with a dead character',
  'faction-gap':           'Leaves a faction with no replacement',
  'hostile-loc':           'In hostile territory',
  'pov-not-involved':      'POV character not in the scene',
  'dead-pov':              'Dead POV character',
  'pov-consecutive':       'Long run of one POV',
  'prose-dead':            'Dead character named in the prose',
  'prose-untagged':        'Named in the prose but not in the cast',
  'prose-leak':            'Possible early reveal in the prose',
  'thread-dangling':       'Subplot raised and never resolved',
  'thread-dormant':        'Subplot goes quiet',
  'thread-unstarted':      'Subplot with no scenes',
}

export interface IssueGroup {
  kind: IssueKind
  label: string
  /** The worst severity in the group — what its heading is coloured by. */
  severity: IssueSeverity
  issues: Issue[]
}

const SEVERITY_RANK: Record<IssueSeverity, number> = { error: 0, warning: 1 }

/**
 * A category's issues, grouped by kind.
 *
 * Errors lead, then the largest groups, so a category opens on its most serious
 * fault rather than on whichever check happened to run first. Within a group
 * the issues keep the order the checks produced them in, which is story order.
 *
 * The order this returns is the order the panel renders *and* the order the
 * keyboard walks — they are derived from the same call, so arrow-key focus
 * cannot drift away from what is on screen.
 */
export function groupIssuesByKind(issues: readonly Issue[]): IssueGroup[] {
  const byKind = new Map<IssueKind, Issue[]>()
  for (const issue of issues) {
    const list = byKind.get(issue.kind)
    if (list) list.push(issue)
    else byKind.set(issue.kind, [issue])
  }

  const groups: IssueGroup[] = [...byKind].map(([kind, list]) => ({
    kind,
    label: ISSUE_KIND_LABELS[kind],
    severity: list.reduce<IssueSeverity>(
      (worst, i) => (SEVERITY_RANK[i.severity] < SEVERITY_RANK[worst] ? i.severity : worst),
      list[0].severity,
    ),
    issues: list,
  }))

  return groups.sort((a, b) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    b.issues.length - a.issues.length ||
    a.label.localeCompare(b.label))
}
