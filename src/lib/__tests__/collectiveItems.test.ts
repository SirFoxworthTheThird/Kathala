import { describe, it, expect } from 'vitest'
import { computeContinuityIssues, type ContinuityInput } from '@/lib/continuity/computeIssues'
import type { Item } from '@/types'

/**
 * A thing there is more than one of.
 *
 * Lembas, elven cloaks and barrow-blades are each one record but many objects,
 * so several characters holding one at the same moment is not a contradiction.
 * Treating it as one accounted for 71 of the 97 issues the shipped Fellowship
 * reported — the checker was wrong, not the example.
 */
describe('collective items', () => {
  const base = (over: Partial<ContinuityInput> = {}): ContinuityInput => ({
    worldId: 'w', world: { id: 'w', name: 'W' } as never,
    chapters: [{ id: 'ch1', worldId: 'w', timelineId: 't', number: 1, title: 'One' } as never],
    allEvents: [{ id: 'e1', worldId: 'w', chapterId: 'ch1', sortOrder: 0, title: 'Setting out',
      involvedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [] } as never],
    characters: [
      { id: 'c1', worldId: 'w', name: 'Frodo' } as never,
      { id: 'c2', worldId: 'w', name: 'Sam' } as never,
    ],
    rels: [], items: [], snapshots: [], knowledgeFacts: [], knowledgeReveals: [],
    sceneTexts: [], allRelSnaps: [], allItemPlacements: [], allLocationSnapshots: [],
    allMarkers: [], allLayers: [], travelModes: [], allMovements: [], artifacts: [],
    allMapRoutes: [], allMapRegions: [], allRegionSnapshots: [], allFactions: [],
    allMemberships: [], allFactionRels: [], allItemSnapshots: [], plotThreads: [],
    ...over,
  } as ContinuityInput)

  /** Two characters holding the same item at the same event. */
  const heldByBoth = (item: Item) => base({
    items: [item],
    snapshots: [
      { id: 's1', worldId: 'w', characterId: 'c1', eventId: 'e1', inventoryItemIds: [item.id], isAlive: true } as never,
      { id: 's2', worldId: 'w', characterId: 'c2', eventId: 'e1', inventoryItemIds: [item.id], isAlive: true } as never,
    ],
  })

  const item = (over: Partial<Item> = {}): Item => ({
    id: 'i1', worldId: 'w', name: 'Elven Cloak', description: '',
    iconType: 'armor', imageId: null, tags: [], ...over,
  })

  it('does not report a kind of thing as being in two places', () => {
    const issues = computeContinuityIssues(heldByBoth(item({ isCollective: true })))
    expect(issues.filter((i) => i.message.includes('multiple places'))).toEqual([])
  })

  it('still reports a unique object in two places', () => {
    // The pairing: without this the check could be switched off entirely and
    // the test above would still pass.
    const issues = computeContinuityIssues(heldByBoth(item({ name: 'The One Ring' })))
    const dup = issues.filter((i) => i.message.includes('multiple places'))
    expect(dup).toHaveLength(1)
    expect(dup[0].severity).toBe('error')
    expect(dup[0].message).toContain('The One Ring')
  })

  it('treats an item with the flag absent as unique, so old records keep their checks', () => {
    const legacy = item({ name: 'Sting' })
    delete (legacy as { isCollective?: boolean }).isCollective
    const issues = computeContinuityIssues(heldByBoth(legacy))
    expect(issues.filter((i) => i.message.includes('multiple places'))).toHaveLength(1)
  })
})
