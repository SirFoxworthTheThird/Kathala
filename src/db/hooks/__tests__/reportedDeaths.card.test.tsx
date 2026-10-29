import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '@/db/database'
import { CharacterCard } from '@/features/characters/CharacterCard'
import { useKnowledgeFacts } from '@/db/hooks/useKnowledge'
import { useAppStore } from '@/store'
import type { Character, KnowledgeFact, WorldEvent } from '@/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let container: HTMLDivElement
let root: Root
const deceased = () => [...container.querySelectorAll('span')].filter(node => node.textContent?.trim() === 'deceased')
const name = (value: string) => [...container.querySelectorAll('span')].find(node => node.textContent === value)!
async function settled(check: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    check()
  }, { timeout: 3000, interval: 20 })
}

const people: Character[] = ['nun', 'doctor'].map(id => ({
  id, worldId: 'world', name: id === 'nun' ? 'The nun' : 'The doctor',
  aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true,
  color: null, createdAt: 1, updatedAt: 1,
}))
const events: WorldEvent[] = ['before', 'report'].map((id, sortOrder) => ({
  id, worldId: 'world', chapterId: 'chapter', timelineId: 'timeline',
  title: id, description: '', locationMarkerId: null,
  involvedCharacterIds: [], mentionedCharacterIds: ['nun'], involvedItemIds: [],
  tags: [], sortOrder, travelDays: 0, inWorldTime: sortOrder, tension: 1,
  structureBeat: null, threadIds: [], motifIds: [], status: 'final',
  povCharacterId: null, isFlashback: false, createdAt: 1, updatedAt: 1,
}))
const report: KnowledgeFact = {
  id: 'nun-death', worldId: 'world', title: 'The nun has died',
  description: 'The gardener reports her death.', tags: ['offstage-death:nun'],
  originEventId: 'report', readerLearnsAtEventId: 'report', createdAt: 1, updatedAt: 1,
}

function Cards() {
  const facts = useKnowledgeFacts('world')
  return <>
    <span data-testid="loaded-facts">{facts.length}</span>
    {people.map(character => <CharacterCard key={character.id} character={character} />)}
  </>
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.chapters.put({ id: 'chapter', worldId: 'world', timelineId: 'timeline', number: 1,
    title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: 1, updatedAt: 1 })
  await db.events.bulkPut(events)
  await db.characters.bulkPut(people)
  await db.knowledgeFacts.put(report)
  useAppStore.setState({ activeWorldId: 'world', activeEventId: 'before', eventByWorld: { world: 'before' } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})
afterAll(async () => { await db.delete() })

it('shows the death at the cursor, rewinds it, and leaves the appearance history empty', async () => {
  act(() => root.render(<MemoryRouter initialEntries={['/worlds/world/characters']}>
    <Routes><Route path="/worlds/:worldId/characters" element={<Cards />} /></Routes>
  </MemoryRouter>))
  await settled(() => expect(container.querySelector('[data-testid="loaded-facts"]')).toHaveTextContent('1'))
  expect(deceased()).toHaveLength(0)
  expect(await db.characterSnapshots.count()).toBe(0)

  act(() => useAppStore.getState().setActiveEventId('report'))
  await settled(() => expect(deceased()).toHaveLength(1))
  expect(name('The nun')).toHaveClass('line-through')
  expect(name('The doctor')).not.toHaveClass('line-through')
  expect((await db.events.get('report'))?.involvedCharacterIds).toEqual([])
  expect(await db.characterSnapshots.count()).toBe(0)

  act(() => useAppStore.getState().setActiveEventId('before'))
  await settled(() => expect(deceased()).toHaveLength(0))
  expect(await db.characterSnapshots.count()).toBe(0)
})
