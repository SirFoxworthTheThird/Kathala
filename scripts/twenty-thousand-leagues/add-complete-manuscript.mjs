import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildSceneDrafts, sourceChapters } from './full-scene-drafts.mjs'

const examplePath = 'example/Twenty Thousand Leagues Under the Seas.pwk', libraryPath = 'public/library/twenty-thousand-leagues-under-the-seas.pwk'
const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'))
assert.equal(data.chapters.length, 46); assert.equal(data.events.length, 92)

const byTitle = (...titles) => { const event = data.events.find(candidate => titles.includes(candidate.title)); assert(event, `Missing event: ${titles.join(' or ')}`); return event }
const reorder = (chapterNumber, titles) => {
  const chapter = data.chapters.find(candidate => candidate.number === chapterNumber)
  titles.forEach((title, index) => {
    const event = byTitle(title); event.chapterId = chapter.id; event.sortOrder = index; event.tags = [chapterNumber <= 23 ? 'part-one' : 'part-two', `chapter-${chapterNumber}`]
    for (const snapshot of data.characterSnapshots.filter(candidate => candidate.eventId === event.id)) snapshot.sortKey = chapterNumber * 100 + index
    for (const placement of data.itemPlacements.filter(candidate => candidate.eventId === event.id)) placement.sortKey = chapterNumber * 100 + index
  })
}

const florida = byTitle('A Violent Shock Injures a Sailor', 'The Florida Lies Wrecked')
florida.title = 'The Florida Lies Wrecked'
florida.description = 'The Nautilus passes the recently sunken Florida, whose drowned passengers remain visible through the salon glass.'
florida.locationMarkerId = 'twenty-thousand-leagues-under-the-seas-loc-salon'
florida.involvedCharacterIds = ['twenty-thousand-leagues-under-the-seas-char-aronnax', 'twenty-thousand-leagues-under-the-seas-char-ned', 'twenty-thousand-leagues-under-the-seas-char-conseil']
data.characterSnapshots = data.characterSnapshots.filter(snapshot => snapshot.eventId !== florida.id)
data.characterSnapshots.push(
  { worldId: data.world.id, createdAt: data.world.createdAt, updatedAt: data.world.updatedAt, id: `${florida.id}-aronnax`, characterId: 'twenty-thousand-leagues-under-the-seas-char-aronnax', eventId: florida.id, isAlive: true, currentLocationMarkerId: florida.locationMarkerId, currentMapLayerId: 'twenty-thousand-leagues-under-the-seas-map-nautilus', inventoryItemIds: [], inventoryNotes: '', travelModeId: null, sortKey: 1701, statusNotes: 'Studies the newly sunken Florida and confronts the human cost preserved beyond the salon glass.' },
  { worldId: data.world.id, createdAt: data.world.createdAt, updatedAt: data.world.updatedAt, id: `${florida.id}-ned`, characterId: 'twenty-thousand-leagues-under-the-seas-char-ned', eventId: florida.id, isAlive: true, currentLocationMarkerId: florida.locationMarkerId, currentMapLayerId: 'twenty-thousand-leagues-under-the-seas-map-nautilus', inventoryItemIds: [], inventoryNotes: '', travelModeId: null, sortKey: 1701, statusNotes: 'Identifies the upright wreck as a recently disabled ship.' },
  { worldId: data.world.id, createdAt: data.world.createdAt, updatedAt: data.world.updatedAt, id: `${florida.id}-conseil`, characterId: 'twenty-thousand-leagues-under-the-seas-char-conseil', eventId: florida.id, isAlive: true, currentLocationMarkerId: florida.locationMarkerId, currentMapLayerId: 'twenty-thousand-leagues-under-the-seas-map-nautilus', inventoryItemIds: [], inventoryNotes: '', travelModeId: null, sortKey: 1701, statusNotes: 'Observes the wreck and its drowned passengers beside Aronnax and Ned.' },
)

const milkSea = byTitle('Nemo Defends the Right to Hunt', 'A Sea of Milk Glows at Night')
milkSea.title = 'A Sea of Milk Glows at Night'
milkSea.description = 'Myriads of luminous infusoria turn the Bay of Bengal white beneath the Nautilus.'
milkSea.involvedCharacterIds = ['twenty-thousand-leagues-under-the-seas-char-aronnax', 'twenty-thousand-leagues-under-the-seas-char-conseil']
data.characterSnapshots = data.characterSnapshots.filter(snapshot => snapshot.eventId !== milkSea.id)
data.characterSnapshots.push(
  { worldId: data.world.id, createdAt: data.world.createdAt, updatedAt: data.world.updatedAt, id: `${milkSea.id}-aronnax`, characterId: 'twenty-thousand-leagues-under-the-seas-char-aronnax', eventId: milkSea.id, isAlive: true, currentLocationMarkerId: milkSea.locationMarkerId, currentMapLayerId: 'twenty-thousand-leagues-under-the-seas-map-world', inventoryItemIds: [], inventoryNotes: '', travelModeId: null, sortKey: 2401, statusNotes: 'Explains that myriads of luminous infusoria have transformed the Bay of Bengal into a vast sea of milk.' },
  { worldId: data.world.id, createdAt: data.world.createdAt, updatedAt: data.world.updatedAt, id: `${milkSea.id}-conseil`, characterId: 'twenty-thousand-leagues-under-the-seas-char-conseil', eventId: milkSea.id, isAlive: true, currentLocationMarkerId: milkSea.locationMarkerId, currentMapLayerId: 'twenty-thousand-leagues-under-the-seas-map-world', inventoryItemIds: [], inventoryNotes: '', travelModeId: null, sortKey: 2401, statusNotes: 'Questions Aronnax about the astonishing white glow and marvels at the countless organisms producing it.' },
)
const avenger = byTitle('Nemo Plays to the Portraits of the Dead', 'Nemo Salutes the Avenger')
avenger.title = 'Nemo Salutes the Avenger'
avenger.description = 'Nemo identifies the patriotic wreck whose resting place the Nautilus has deliberately sought.'
avenger.involvedCharacterIds = ['twenty-thousand-leagues-under-the-seas-char-nemo', 'twenty-thousand-leagues-under-the-seas-char-aronnax']
data.characterSnapshots = data.characterSnapshots.filter(snapshot => snapshot.eventId !== avenger.id)
data.characterSnapshots.push(
  { worldId: data.world.id, createdAt: data.world.createdAt, updatedAt: data.world.updatedAt, id: `${avenger.id}-nemo`, characterId: 'twenty-thousand-leagues-under-the-seas-char-nemo', eventId: avenger.id, isAlive: true, currentLocationMarkerId: avenger.locationMarkerId, currentMapLayerId: 'twenty-thousand-leagues-under-the-seas-map-nautilus', inventoryItemIds: [], inventoryNotes: '', travelModeId: null, sortKey: 4301, statusNotes: 'Names the wreck as the Avenger and solemnly honors the revolutionary history of the ship he deliberately sought.' },
  { worldId: data.world.id, createdAt: data.world.createdAt, updatedAt: data.world.updatedAt, id: `${avenger.id}-aronnax`, characterId: 'twenty-thousand-leagues-under-the-seas-char-aronnax', eventId: avenger.id, isAlive: true, currentLocationMarkerId: avenger.locationMarkerId, currentMapLayerId: 'twenty-thousand-leagues-under-the-seas-map-nautilus', inventoryItemIds: [], inventoryNotes: '', travelModeId: null, sortKey: 4301, statusNotes: 'Recognizes that the Nautilus has circled the seabed to find this particular wreck and listens as Nemo recounts its history.' },
)

reorder(17, ['Ned Demands an Escape Plan', 'The Florida Lies Wrecked'])
reorder(24, ['The Nautilus Crosses the Indian Ocean', 'A Sea of Milk Glows at Night'])
reorder(25, ['Nemo Invites the Captives to the Pearl Banks'])
reorder(26, ['The Divers Enter the Silent Fishery', 'Nemo Shows Aronnax the Giant Pearl', 'Nemo Saves the Pearl Diver'])
reorder(27, ['Nemo Explains the Red Sea', 'Nemo Reveals the Hidden Passage'])
reorder(28, ['A Dugong Hunt Tests Ned’s Patience', 'The Nautilus Shoots beneath Suez'])
reorder(43, ['The Nautilus Visits the Cable and Wrecks', 'Nemo Salutes the Avenger'])
const chapterEvents = data.chapters.map(chapter => data.events.filter(event => event.chapterId === chapter.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
const { sceneDrafts, anchors } = buildSceneDrafts(chapterEvents), orderedEvents = chapterEvents.flat()
data.sceneTexts = orderedEvents.map((event, index) => ({ id: `ttl-scene-${String(index + 1).padStart(3, '0')}`, worldId: data.world.id, eventId: event.id, text: sceneDrafts[index], wordCount: (sceneDrafts[index].match(/\S+/g) ?? []).length, createdAt: data.world.updatedAt, updatedAt: data.world.updatedAt }))
const sourceLore = data.lorePages?.find(page => /source|artwork|edition/i.test(`${page.title} ${page.body}`))
if (sourceLore) sourceLore.body = 'The manuscript contains the complete narrative text of Project Gutenberg eBook #164, divided across all 46 chapters and modeled events. Gutenberg packaging, contents, part headings, and repeated chapter headings are excluded. Maps and illustrations are documented separately in this page.'
const text = `${JSON.stringify(data, null, 2)}\n`; fs.writeFileSync(examplePath, text); fs.writeFileSync(libraryPath, text)
const index = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8')), entry = index.entries.find(candidate => candidate.id === 'twenty-thousand-leagues-under-the-seas'); assert(entry)
entry.dataBytes = Buffer.byteLength(text); entry.notice = 'Unofficial reading-mode reference for a public-domain novel. The manuscript contains the complete narrative text of Project Gutenberg eBook #164 across all 46 chapters; Gutenberg packaging and front matter are excluded. Linked maps and public-domain illustrations are recorded in Lore.'
fs.writeFileSync('public/library/index.json', `${JSON.stringify(index, null, 2)}\n`)
console.log({ chapters: sourceChapters.length, events: data.events.length, scenes: data.sceneTexts.length, words: data.sceneTexts.reduce((sum, scene) => sum + scene.wordCount, 0) }); for (const anchor of anchors) console.log(`${anchor.chapter}: ${anchor.event} <- ${anchor.paragraph}: ${anchor.excerpt}`)
