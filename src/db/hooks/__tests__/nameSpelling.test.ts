import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createCharacter, updateCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { createLocationMarker, updateLocationMarker, deleteLocationMarker } from '@/db/hooks/useLocationMarkers'
import { createItem, deleteItem } from '@/db/hooks/useItems'
import { createFaction, updateFaction } from '@/db/hooks/useFactions'
import { setSpellingAccepted, worldNameSource } from '@/db/hooks/useNameSpelling'
import { nameWords, worldNames } from '@/lib/nameSpelling'

/*
  The world's names, as spelling reads them from the store (issue #705): they
  follow the store as names are added, renamed and deleted.
*/

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

const words = async (worldId: string) => nameWords(worldNames(await worldNameSource(worldId)))

describe('the name list follows the store', () => {
  it('as people, places, items and factions are added, renamed and deleted', async () => {
    const world = await createWorld({ name: 'Hesk', description: '' })
    const other = await createWorld({ name: 'Elsewhere', description: '' })
    await createCharacter({ worldId: other.id, name: 'Nobody Here', description: '' })
    expect(await words(world.id)).toEqual([])

    const teo = await createCharacter({ worldId: world.id, name: 'Teodora Vasse', description: '' })
    const place = await createLocationMarker({ worldId: world.id, mapLayerId: null, name: 'Grimward', description: '', iconType: 'city' })
    const lamp = await createItem({ worldId: world.id, name: 'Lantern of Hesk', description: '', iconType: 'tool', tags: [] })
    const order = await createFaction({ worldId: world.id, name: 'Ashen Order', description: '', color: '#000', coverImageId: null, tags: [] })
    expect(await words(world.id)).toEqual(['Teodora', 'Vasse', 'Grimward', 'Lantern', 'of', 'Hesk', 'Ashen', 'Order'])

    // An alias, a rename and an earlier name.
    await updateCharacter(teo.id, { name: 'Teodora Marl', aliases: ['Teo'], nameChanges: [{ name: 'Teodora Vasse', fromEventId: null } as never] })
    await updateLocationMarker(place.id, { name: 'Grimwardine' })
    await updateFaction(order.id, { name: 'Ashen Circle' })
    expect(await words(world.id)).toEqual(['Teodora', 'Marl', 'Teo', 'Vasse', 'Grimwardine', 'Lantern', 'of', 'Hesk', 'Ashen', 'Circle'])

    // Deleted, gone.
    await deleteCharacter(teo.id)
    await deleteLocationMarker(place.id)
    await deleteItem(lamp.id)
    expect(await words(world.id)).toEqual(['Ashen', 'Circle'])
  })

  it('a word said not to be a misspelt name is kept with the world, once, and can be taken back', async () => {
    const world = await createWorld({ name: 'Hesk', description: '' })
    await setSpellingAccepted(world.id, 'Athens', true)
    await setSpellingAccepted(world.id, 'ATHENS', true)
    await setSpellingAccepted(world.id, 'Giotto', true)
    expect((await db.worlds.get(world.id))?.spellingAccepted).toEqual(['athens', 'giotto'])
    await setSpellingAccepted(world.id, 'athens', false)
    expect((await db.worlds.get(world.id))?.spellingAccepted).toEqual(['giotto'])
  })
})
