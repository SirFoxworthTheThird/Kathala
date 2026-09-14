import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildSceneDrafts, sourceChapters } from './full-scene-drafts.mjs'

const examplePath = 'example/The Count of Monte Cristo.pwk'
const libraryPath = 'public/library/the-count-of-monte-cristo.pwk'
const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'))
assert.equal(data.chapters.length, 117)
assert.equal(data.events.length, 149)
const byTitle = (...titles) => { const event = data.events.find(candidate => titles.includes(candidate.title)); assert(event, `Missing event: ${titles.join(' or ')}`); return event }
const reorder = (chapterNumber, titles) => {
  const chapter = data.chapters.find(candidate => candidate.number === chapterNumber)
  titles.forEach((title, index) => {
    const event = byTitle(title)
    event.chapterId = chapter.id
    event.sortOrder = index
    event.tags = [`chapter-${chapterNumber}`]
    for (const snapshot of data.characterSnapshots.filter(candidate => candidate.eventId === event.id)) snapshot.sortKey = chapterNumber * 100 + index
    for (const placement of data.itemPlacements.filter(candidate => candidate.eventId === event.id)) placement.sortKey = chapterNumber * 100 + index
  })
}
const resetSnapshots = (event, states) => {
  event.involvedCharacterIds = Object.keys(states).map(key => `count-of-monte-cristo-char-${key}`)
  data.characterSnapshots = data.characterSnapshots.filter(snapshot => snapshot.eventId !== event.id)
  const marker = data.locationMarkers.find(candidate => candidate.id === event.locationMarkerId)
  data.characterSnapshots.push(...Object.entries(states).map(([key, statusNotes]) => ({
    worldId: data.world.id, createdAt: data.world.createdAt, updatedAt: data.world.updatedAt,
    id: `${event.id}-${key}`, characterId: `count-of-monte-cristo-char-${key}`, eventId: event.id,
    isAlive: true, currentLocationMarkerId: event.locationMarkerId, currentMapLayerId: marker?.mapLayerId ?? null,
    inventoryItemIds: [], inventoryNotes: '', travelModeId: null, sortKey: 0, statusNotes,
  })))
}

const hundredDays = byTitle('Elba’s Errand Becomes Treason', 'Old Dantès Dies Without His Son', 'The Conspirators Prosper While Old Dantès Dies')
hundredDays.title = 'Old Dantès Dies Without His Son'
hundredDays.title = 'The Conspirators Prosper While Old Dantès Dies'
hundredDays.description = 'After Waterloo restores the Bourbons, Danglars and Fernand prosper while Edmond’s father loses his last hope and dies in poverty.'
const haydeeWelcome = byTitle('Haydée Recounts the Fall of Yanina', 'Haydée Welcomes Albert')
haydeeWelcome.title = 'Haydée Welcomes Albert'
haydeeWelcome.description = 'Haydée receives Albert in her apartments and agrees to tell him the history of her father and her lost homeland.'
const haydeeChildhood = byTitle('Haydée Produces the Sale Record', 'Haydée Remembers Ali Pasha')
haydeeChildhood.title = 'Haydée Remembers Ali Pasha'
haydeeChildhood.description = 'Haydée recalls her childhood beside Ali Pasha and Vasiliki before treachery closes around Yanina.'
const noirtierNotary = byTitle('Franz Reads the Duel Account', 'Noirtier Demands a Notary')
noirtierNotary.title = 'Noirtier Demands a Notary'
noirtierNotary.description = 'After spelling out his resolve through Valentine, Noirtier insists that a notary be summoned immediately.'
const contractSummoned = byTitle('Franz Breaks the Engagement', 'The Marriage Contract Is Summoned')
contractSummoned.title = 'The Marriage Contract Is Summoned'
contractSummoned.description = 'Villefort presses ahead after the funeral, assembles the witnesses, and prepares to sign Valentine’s marriage contract.'
const valentineFound = byTitle('Valentine Is Removed in Secret', 'Maximilien Finds Valentine Dead')
valentineFound.title = 'Maximilien Finds Valentine Dead'
valentineFound.description = 'Summoned by Noirtier’s distress, Maximilien reaches Valentine’s open chamber and finds the household mourning her apparent death.'
const assizeCrowd = byTitle('Benedetto Names His Father', 'Paris Crowds the Assize Court')
assizeCrowd.title = 'Paris Crowds the Assize Court'
assizeCrowd.description = 'Rumor and scandal fill the Palais de Justice as Paris crowds in to witness Benedetto’s sensational trial.'
const courtEnters = byTitle('Villefort Leaves the Bench', 'The Court Takes Its Places')
courtEnters.title = 'The Court Takes Its Places'
courtEnters.description = 'Spectators trade the latest Villefort rumors until the sergeant calls the room to order and the court enters.'
const heloiseDead = byTitle('Villefort Gives a Private Sentence', 'Villefort Finds Héloïse Dead')
heloiseDead.title = 'Villefort Finds Héloïse Dead'
heloiseDead.description = 'Racing home to revoke his terrible command, Villefort finds Héloïse dead and discovers that she has taken Édouard with her.'
const fariaManuscript = byTitle('The Register Confirms the Burial', 'Faria’s Manuscript Survives')
fariaManuscript.title = 'Faria’s Manuscript Survives'
fariaManuscript.description = 'In Faria’s former cell, Edmond receives the cloth manuscript that preserved his teacher’s great work.'
const noirtierOpposes = byTitle('Noirtier Tells the Truth with His Eyes')
noirtierOpposes.description = 'Through Valentine’s patient reading of his eyes, Noirtier makes clear that he opposes her marriage and intends to act.'
const morrelDespairs = byTitle('The Young Lovers Are Reunited', 'Maximilien Chooses Death')
morrelDespairs.title = 'Maximilien Chooses Death'
morrelDespairs.description = 'Believing Valentine lost forever, Maximilien accepts the Count’s final draught and prepares to die at Monte Cristo.'

resetSnapshots(hundredDays, {
  'louis-dantes': 'Loses his final hope after Waterloo ends Morrel’s petitions and dies without seeing Edmond again.',
  morrel: 'Exhausts every lawful effort to free Edmond and can offer the old father no further hope.',
  danglars: 'Builds a prosperous career while understanding the ruin caused by the denunciation.',
  fernand: 'Uses Edmond’s absence and military promotion to advance toward the life he coveted.',
})
resetSnapshots(haydeeWelcome, {
  haydee: 'Receives Albert with grave courtesy and agrees to tell him the history of her father and Yanina.',
  albert: 'Enters Haydée’s apartments curious about the history behind the Count’s protected household.',
  edmond: 'Introduces Albert to Haydée and allows her to control the telling of her own history.',
})
resetSnapshots(haydeeChildhood, {
  haydee: 'Reconstructs her childhood beside Ali Pasha and Vasiliki before the betrayal of Yanina.',
  albert: 'Listens as a romantic Eastern history becomes a personal account of political violence.',
  'ali-pasha': 'Appears in Haydée’s memory as her powerful and affectionate father before his fall.',
})
resetSnapshots(noirtierOpposes, {
  noirtier: 'Uses the language of his eyes to reject the marriage arranged for Valentine.',
  valentine: 'Interprets her grandfather’s gaze and discovers his determination to intervene.',
})
resetSnapshots(noirtierNotary, {
  noirtier: 'Insists that a notary be summoned despite Villefort’s resistance.',
  valentine: 'Translates her grandfather’s demand and sends for the legal help he requests.',
  villefort: 'Recognizes that his father intends a legal challenge to the family’s plans.',
  barrois: 'Supports his master’s clearly expressed wish and leaves to fetch a notary.',
})
resetSnapshots(contractSummoned, {
  franz: 'Returns with his witnesses prepared to honor the engagement despite the household’s mourning.',
  valentine: 'Is summoned pale and grieving to a contract ceremony she does not desire.',
  villefort: 'Presses the marriage arrangements forward immediately after the funeral.',
})
resetSnapshots(valentineFound, {
  maximilien: 'Follows Noirtier’s urgent signal and reaches Valentine’s chamber only to find her apparently dead.',
  valentine: 'Lies motionless under the Count’s protective draught while the household believes her dead.',
  noirtier: 'Cannot speak his knowledge and drives Maximilien toward the open chamber with desperate looks.',
  villefort: 'Staggers under the apparent death of his daughter.',
  avrigny: 'Pronounces Valentine dead before the grieving household.',
})
resetSnapshots(assizeCrowd, {
  beauchamp: 'Trades reports and speculation while waiting for the celebrated trial to begin.',
  'chateau-renaud': 'Joins the crowded court and listens to rumors surrounding Benedetto and Villefort.',
  debray: 'Observes the social spectacle gathering around the criminal proceedings.',
})
resetSnapshots(courtEnters, {
  beauchamp: 'Ends the conversation when the court’s arrival is announced.',
  'chateau-renaud': 'Returns to his place as the assize court enters.',
  debray: 'Takes his place among the spectators for the opening of the trial.',
})
resetSnapshots(heloiseDead, {
  villefort: 'Returns intending mercy but finds Héloïse dead and discovers Édouard beside her.',
  heloise: 'Carries out the death sentence implied by her husband and refuses to leave her son behind.',
  edouard: 'Is found lifeless beside his mother after drinking the poison she gave him.',
})
resetSnapshots(fariaManuscript, {
  edmond: 'Receives Faria’s surviving cloth manuscript and treats it as a treasure beyond money.',
})
resetSnapshots(morrelDespairs, {
  maximilien: 'Believes Valentine irretrievably lost and willingly drinks what he thinks will end his life.',
  edmond: 'Tests Maximilien’s promise at the appointed hour while preparing the revelation that will restore hope.',
})

reorder(8, ['The Boat Passes the Harbour', 'The Fortress Blocks the Open Sea'])
reorder(13, ['The Regimes Change Around the Prisoner', 'The Conspirators Prosper While Old Dantès Dies'])
reorder(41, ['Fernand Welcomes His Unknown Enemy', 'Mercédès Recognizes Edmond'])
reorder(47, ['The Dappled Grays Run Away', 'Ali Stops the Runaway Carriage'])
reorder(58, ['Noirtier Tells the Truth with His Eyes', 'Noirtier Demands a Notary'])
reorder(74, ['The Family Vault Closes', 'The Marriage Contract Is Summoned'])
reorder(77, ['Haydée Welcomes Albert', 'Haydée Remembers Ali Pasha', 'Yanina Falls to Betrayal', 'Haydée Is Sold at Constantinople'])
reorder(102, ['Valentine Appears to Die', 'Maximilien Finds Valentine Dead'])
reorder(109, ['Paris Crowds the Assize Court', 'The Court Takes Its Places'])
reorder(111, ['Villefort Finds Héloïse Dead', 'The Count Sees the Child'])
reorder(113, ['Edmond Returns to Château d’If', 'Faria’s Manuscript Survives'])
reorder(117, ['Maximilien Chooses Death', 'Wait and Hope'])

const chapterEvents = data.chapters.map(chapter => data.events.filter(event => event.chapterId === chapter.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
const { sceneDrafts, anchors } = buildSceneDrafts(chapterEvents)
const orderedEvents = chapterEvents.flat()
data.sceneTexts = orderedEvents.map((event, index) => ({ id: `monte-cristo-scene-${String(index + 1).padStart(3, '0')}`, worldId: data.world.id, eventId: event.id, text: sceneDrafts[index], wordCount: (sceneDrafts[index].match(/\S+/g) ?? []).length, createdAt: data.world.updatedAt, updatedAt: data.world.updatedAt }))
const sourceLore = data.lorePages?.find(page => /source|artwork|edition/i.test(`${page.title} ${page.body}`))
if (sourceLore) sourceLore.body = 'The manuscript contains the complete narrative text of Project Gutenberg eBook #1184, divided across all 117 chapters and modeled events. Gutenberg packaging, contents, and illustration-only artifacts are excluded. Maps and illustrations are documented separately in this page.'
const text = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync(examplePath, text)
fs.writeFileSync(libraryPath, text)
const index = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8'))
const entry = index.entries.find(candidate => candidate.id === 'the-count-of-monte-cristo'); assert(entry)
entry.dataBytes = Buffer.byteLength(text)
entry.notice = 'Unofficial reading-mode reference for a public-domain novel. The manuscript contains the complete narrative text of Project Gutenberg eBook #1184 across all 117 chapters; Gutenberg packaging and front matter are excluded. Linked maps and public-domain illustrations are recorded in Lore.'
fs.writeFileSync('public/library/index.json', `${JSON.stringify(index, null, 2)}\n`)
console.log({ chapters: sourceChapters.length, events: data.events.length, scenes: data.sceneTexts.length, words: data.sceneTexts.reduce((sum, scene) => sum + scene.wordCount, 0) })
for (const anchor of anchors) console.log(`${anchor.chapter}: ${anchor.event} <- ${anchor.paragraph}: ${anchor.excerpt}`)
