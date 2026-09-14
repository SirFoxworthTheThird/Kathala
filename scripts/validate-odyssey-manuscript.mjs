import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { sceneDrafts } from './odyssey/full-scene-drafts.mjs'

const paths = ['example/The Odyssey.pwk', 'public/library/the-odyssey.pwk']
const hashes = []

for (const path of paths) {
  const raw = fs.readFileSync(path, 'utf8')
  const data = JSON.parse(raw)
  assert.equal(data.chapters.length, 24, `${path} must contain 24 books`)
  assert.equal(data.events.length, 68, `${path} must contain 68 modeled events`)
  assert.equal(data.sceneTexts.length, 68, `${path} must contain one scene text per event`)

  const sceneByEvent = new Map(data.sceneTexts.map(scene => [scene.eventId, scene]))
  let words = 0
  data.events.forEach((event, index) => {
    const scene = sceneByEvent.get(event.id)
    assert(scene, `${path} is missing prose for ${event.id}`)
    assert.equal(scene.text, sceneDrafts[index], `${path} prose differs from the source assignment for ${event.id}`)
    const wordCount = scene.text.trim().split(/\s+/u).length
    assert.equal(scene.wordCount, wordCount, `${path} has a stale word count for ${event.id}`)
    words += wordCount
  })

  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  hashes.push(hash)
  console.log(JSON.stringify({ path, chapters: 24, events: 68, sceneTexts: 68, words, bytes: Buffer.byteLength(raw), sha256: hash }, null, 2))
}

assert.equal(hashes[0], hashes[1], 'Editable and Library Odyssey PWKs must be identical')

const catalogue = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8'))
const entry = catalogue.entries.find(candidate => candidate.id === 'the-odyssey')
assert(entry, 'The Odyssey is missing from the Library catalogue')
assert.equal(entry.dataBytes, fs.statSync(paths[1]).size, 'The Odyssey Library byte count is stale')

