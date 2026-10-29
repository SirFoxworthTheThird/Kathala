import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { db } from '@/db/database'
import { ReadingGateProvider, useGate } from '@/db/hooks/ReadingGateContext'
import { useFactionMemberships, useMembershipsForCharacter, useMembershipsForFaction } from '@/db/hooks/useFactions'
import { useAppStore } from '@/store'
import type { WorldEvent } from '@/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let container: HTMLDivElement
let root: Root

function Lists() {
  const gate = useGate()
  const all = useFactionMemberships('world')
  const character = useMembershipsForCharacter('person')
  const futureFaction = useMembershipsForFaction('later-faction')
  return <>
    <output data-testid="gate">{String(gate.active)}</output>
    <output data-testid="all">{all.map(m => m.id).join(',')}</output>
    <output data-testid="character">{character.map(m => m.id).join(',')}</output>
    <output data-testid="faction">{futureFaction.map(m => m.id).join(',')}</output>
  </>
}

async function settled(check: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    check()
  }, { timeout: 3000, interval: 20 })
}
const text = (key: string) => container.querySelector(`[data-testid="${key}"]`)?.textContent

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.worlds.put({ id: 'world', name: 'Reader test', description: '', readingMode: true,
    coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 1, updatedAt: 1 })
  await db.chapters.put({ id: 'chapter', worldId: 'world', timelineId: 'timeline', number: 1,
    title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: 1, updatedAt: 1 })
  const events: WorldEvent[] = ['before', 'joined'].map((id, sortOrder) => ({
    id, worldId: 'world', chapterId: 'chapter', timelineId: 'timeline', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: ['person'], mentionedCharacterIds: [], involvedItemIds: [],
    tags: [], sortOrder, travelDays: 0, inWorldTime: sortOrder, tension: 1, structureBeat: null,
    threadIds: [], motifIds: [], status: 'final', povCharacterId: null, isFlashback: false, createdAt: 1, updatedAt: 1,
  }))
  await db.events.bulkPut(events)
  await db.characters.put({ id: 'person', worldId: 'world', name: 'Reader’s character', aliases: [],
    description: '', portraitImageId: null, isAlive: true, color: null, tags: [], createdAt: 1, updatedAt: 1 })
  await db.factionMemberships.bulkPut([
    { id: 'known', worldId: 'world', factionId: 'first-faction', characterId: 'person', role: 'Member',
      startEventId: null, endEventId: null, notes: '', createdAt: 1, updatedAt: 1 },
    { id: 'future', worldId: 'world', factionId: 'later-faction', characterId: 'person', role: 'Gardener',
      startEventId: 'joined', endEventId: null, notes: '', createdAt: 2, updatedAt: 2 },
  ])
  useAppStore.setState({ activeWorldId: 'world', activeEventId: 'before', eventByWorld: { world: 'before' } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })
afterAll(async () => { await db.delete() })

it('withholds future membership from every reader list, reveals it at the joining scene and hides it on rewind', async () => {
  act(() => root.render(<ReadingGateProvider worldId="world"><Lists /></ReadingGateProvider>))
  await settled(() => {
    expect(text('gate')).toBe('true')
    expect(text('all')).toBe('known')
    expect(text('character')).toBe('known')
    expect(text('faction')).toBe('')
  })
  act(() => useAppStore.getState().setActiveEventId('joined'))
  await settled(() => {
    expect(text('all')).toBe('known,future')
    expect(text('character')).toBe('known,future')
    expect(text('faction')).toBe('future')
  })
  act(() => useAppStore.getState().setActiveEventId('before'))
  await settled(() => expect(text('character')).toBe('known'))
  expect(await db.factionMemberships.count()).toBe(2)
})

it('keeps future memberships available to a writer', async () => {
  await db.worlds.update('world', { readingMode: false })
  act(() => root.render(<ReadingGateProvider worldId="world"><Lists /></ReadingGateProvider>))
  await settled(() => {
    expect(text('gate')).toBe('false')
    expect(text('all')).toBe('known,future')
    expect(text('character')).toBe('known,future')
    expect(text('faction')).toBe('future')
  })
})
