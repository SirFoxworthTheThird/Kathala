/*
  Turn a Library book into public/book.json for the editor spike: chapters in order,
  each with its scenes in order and their prose. Run from the repo root:

    KATHALA_LIBRARY=../Kathala-Library node spikes/editor/extract.mjs [file.pwk]
*/
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const library = process.env.KATHALA_LIBRARY ?? '../Kathala-Library'
const file = process.argv[2] ?? 'the-count-of-monte-cristo.pwk'
const world = JSON.parse(readFileSync(join(library, 'library', file), 'utf8'))

const textByEvent = new Map(world.sceneTexts.map((t) => [t.eventId, t.text]))
const chapters = [...world.chapters]
  .sort((a, b) => a.number - b.number)
  .map((c) => ({
    id: c.id,
    title: c.title || `Chapter ${c.number}`,
    scenes: world.events
      .filter((e) => e.chapterId === c.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((e) => ({ id: e.id, title: e.title, text: textByEvent.get(e.id) ?? '' })),
  }))

const words = chapters.flatMap((c) => c.scenes).reduce((n, s) => n + (s.text.match(/\S+/g)?.length ?? 0), 0)
writeFileSync(join(here, 'public', 'book.json'), JSON.stringify({ title: world.world.name, chapters }))
console.log(`${world.world.name}: ${chapters.length} chapters, ${chapters.flatMap((c) => c.scenes).length} scenes, ${words} words`)
