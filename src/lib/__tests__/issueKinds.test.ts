import { describe, it, expect } from 'vitest'
import { groupIssuesByKind, ISSUE_KIND_LABELS, type IssueKind } from '@/lib/continuity/issueKinds'
import type { Issue } from '@/lib/continuity/computeIssues'

const issue = (id: string, kind: IssueKind, severity: Issue['severity'] = 'warning'): Issue => ({
  id, kind, severity, category: 'item', message: id,
})

describe('groupIssuesByKind', () => {
  it('collects a repeated fault into one named group', () => {
    // The finding: "Items 79" was one heading over a single repeated fault,
    // with the real findings buried inside it.
    const groups = groupIssuesByKind([
      issue('a', 'dup-item'), issue('b', 'dup-item'), issue('c', 'dup-item'),
      issue('d', 'item-before-acquired'),
    ])
    expect(groups.map((g) => [g.label, g.issues.length])).toEqual([
      ['Item in two places at once', 3],
      ['Item used before it was acquired', 1],
    ])
  })

  it('puts errors above warnings, however few of them there are', () => {
    // One error among fifty warnings is the case the finding is about.
    const groups = groupIssuesByKind([
      ...Array.from({ length: 50 }, (_, i) => issue(`w${i}`, 'dup-item', 'warning')),
      issue('e', 'item-after-destroyed-ev', 'error'),
    ])
    expect(groups[0].label).toBe('Item used after being destroyed')
    expect(groups[0].severity).toBe('error')
    expect(groups[1].issues).toHaveLength(50)
  })

  it('takes a group\'s severity from its worst member', () => {
    const groups = groupIssuesByKind([
      issue('a', 'dup-item', 'warning'),
      issue('b', 'dup-item', 'error'),
    ])
    expect(groups[0].severity).toBe('error')
  })

  it('orders equal severities by size, then by label', () => {
    const groups = groupIssuesByKind([
      issue('a', 'item-handoff'),
      issue('b', 'dup-item'), issue('c', 'dup-item'),
      issue('d', 'artifact-wrong-timeline'),
    ])
    expect(groups.map((g) => g.kind)).toEqual([
      'dup-item',                 // 2 of them
      // Then the two singletons by label: "Item changes hands across a
      // distance" before "Item outside its declared timelines".
      'item-handoff',
      'artifact-wrong-timeline',
    ])
  })

  it('keeps each group in the order the checks produced it, which is story order', () => {
    const groups = groupIssuesByKind([
      issue('ch1', 'dup-item'), issue('ch2', 'dup-item'), issue('ch3', 'dup-item'),
    ])
    expect(groups[0].issues.map((i) => i.id)).toEqual(['ch1', 'ch2', 'ch3'])
  })

  it('has nothing to group when there is nothing wrong', () => {
    expect(groupIssuesByKind([])).toEqual([])
  })
})

describe('ISSUE_KIND_LABELS', () => {
  it('names every kind, with no duplicates', () => {
    // A missing label renders as undefined in a heading; a duplicated one makes
    // two different faults look like the same one.
    const labels = Object.values(ISSUE_KIND_LABELS)
    expect(labels.every((l) => l.length > 0)).toBe(true)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
