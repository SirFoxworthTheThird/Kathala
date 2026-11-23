import { test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { addBook, countText, emptyCounts, toBaseline, without, type Counts } from '../src/lib/proseChecks/baseline'
import { nearMisses, namesToCheck, nameWords, wordUse, worldNames, NEAR_MISS_RULES, type NearMissRules } from '../src/lib/nameSpelling'
import { LIBRARY } from './proseLibrary'

/*
  Near-miss names against the Library (issue #705): every English book with
  prose, each checked against a dictionary of the other books' words (as the
  shipped baseline is, less this book), so its own words are not already
  known. Every flag on a published book counts as a false alarm. Recall is
  measured by putting a typo into one use of a name in a scene and asking
  whether that scene's check finds it, with the right name.

    KATHALA_LIBRARY=… npx vitest run --config vitest.probe.config.ts scripts/spelling-probe.ts --disableConsoleIntercept
*/
const NOT_ENGLISH = new Set(['os-lusiadas-pt', 'os-maias'])
type W = { characters?: Array<{ name: string; aliases?: string[]; nameChanges?: Array<{ name: string }> }>; locationMarkers?: Array<{ name: string }>; items?: Array<{ name: string }>; factions?: Array<{ name: string }>; sceneTexts?: Array<{ text: string }> }

function rng(seed: number) { return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff } }
function typo(word: string, r: () => number): string {
  const i = 1 + Math.floor(r() * (word.length - 1))
  const kind = Math.floor(r() * 4)
  const letters = 'aeiournstl'
  if (kind === 0 && i < word.length - 1) return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)
  if (kind === 1) return word.slice(0, i) + word.slice(i + 1)
  if (kind === 2) return word.slice(0, i) + letters[Math.floor(r() * letters.length)] + word.slice(i)
  let c = letters[Math.floor(r() * letters.length)]
  if (c === word[i]) c = 'x'
  return word.slice(0, i) + c + word.slice(i + 1)
}

/*
  The flags on the Library that are real near misses: the word spells the same
  person or place as the name it is flagged against, differently — the books'
  own inconsistencies (Nortier for Noirtier, Daisey for Daisy), an accent or a
  scansion mark (Os Lusíadas), another language's form of the same name
  (Colosseo, Alberto). Judged by reading each pair; every other flag is a
  false alarm: another word, or another person (Athens for Athena, Giotto).
*/
const REAL = new Set(['Theophile', 'Boute', 'Balwhidder', 'Lettervore', 'Bhaery', 'Daisey', 'Lawrence', 'Moffatt', 'Mullet', 'AZORE',
  'Adamástor', 'Amphitritè', 'Amphitrité', 'Bad’ajoz', 'Belem', 'Cal’ecut', 'Cat’uals', 'Diniz', 'Ferd’inand', 'Galatéa', 'Giraldó', 'Guimaraens',
  'Ismár', 'Le’onard', 'Le’onardo', 'Magriçe', 'Manoel', 'Mombas', 'Mombásah', 'Moníz', 'Mozambíque', 'Portugall', 'Port’ugal', 'Port’ugale',
  'Samo’rim', 'Sam’orim', 'Sant’arem', 'Sofála', 'Nicholas', 'Buonagiunta', 'Matilda', 'Manfredi', 'Chilcoot', 'Alberto', 'Cavalcante', 'Colosseo',
  'Gerard', 'Nortier', 'Diomede', 'Anticlea', 'Telepylos', 'Loffoden', 'Bertram', 'Caccianimico'])

test('near-miss names on the Library', () => {
  const books: Array<{ name: string; w: W; counts: Counts; texts: string[] }> = []
  for (const file of readdirSync(LIBRARY).filter((f) => f.endsWith('.pwk')).sort()) {
    const name = file.replace('.pwk', '')
    if (NOT_ENGLISH.has(name)) continue
    const w = JSON.parse(readFileSync(join(LIBRARY, file), 'utf8')) as W
    const texts = (w.sceneTexts ?? []).map((t) => t.text).filter((t) => t?.trim())
    if (!texts.length) continue
    const counts = emptyCounts()
    for (const t of texts) countText(t, counts)
    books.push({ name, w, counts, texts })
  }
  const all = emptyCounts()
  for (const b of books) addBook(all, b.counts)

  const variants: Array<[string, NearMissRules]> = [
    ['shipped', NEAR_MISS_RULES],
    ['min 4', { ...NEAR_MISS_RULES, minLength: 4 }],
    ['min 6', { ...NEAR_MISS_RULES, minLength: 6 }],
    ['any first letter', { ...NEAR_MISS_RULES, sameFirst: false }],
    ['lower case too', { ...NEAR_MISS_RULES, capitalOnly: false }],
    ['used 2', { ...NEAR_MISS_RULES, usedTimes: 2 }],
    ['used 5', { ...NEAR_MISS_RULES, usedTimes: 5 }],
    ['one edit to 9', { ...NEAR_MISS_RULES, oneEditUpTo: 9 }],
    ['one edit to 5', { ...NEAR_MISS_RULES, oneEditUpTo: 5 }],
  ]
  for (const [label, rules] of variants) {
    let words = 0, flags = 0, real = 0, tried = 0, found = 0, right = 0
    const per: string[] = []
    const examples: string[] = []
    for (const b of books) {
      const dict = toBaseline(without(all, b.counts)).words
      const isCommon = (l: string) => l in dict
      const names = worldNames({ characters: b.w.characters ?? [], places: b.w.locationMarkers ?? [], items: b.w.items ?? [], factions: b.w.factions ?? [] })
      const check = namesToCheck(names, isCommon, rules)
      const known = new Set(nameWords(names).map((x) => x.toLowerCase()))
      const use = wordUse(b.texts)
      const used = (l: string) => use.get(l) ?? 0
      let bf = 0
      for (const t of b.texts) {
        const found0 = nearMisses(t, check, known, isCommon, used, rules)
        bf += found0.length
        real += found0.filter((f) => REAL.has(f.word)).length
        for (const f of found0) if (examples.length < 400) examples.push(`${b.name}: ${f.word} → ${f.name}`)
      }
      const bw = b.counts.total
      words += bw; flags += bf
      per.push(`${b.name}:${bf}`)
      // Recall: a typo put into one use of a checked name, in scenes that use it.
      const r = rng(705)
      for (const name of check) {
        const scene = b.texts.find((t) => new RegExp(`\\b${name}\\b`).test(t))
        if (!scene) continue
        const bad = typo(name, r)
        if (bad.toLowerCase() === name.toLowerCase()) continue
        tried++
        const text = scene.replace(new RegExp(`\\b${name}\\b`), bad)
        const got = nearMisses(text, check, known, isCommon, (l) => (l === bad.toLowerCase() ? 1 : used(l)), rules).filter((f) => f.word === bad)
        if (got.length) { found++; if (got[0].name === name) right++ }
      }
    }
    console.log(`${label.padEnd(18)} ${books.length} books, ${words} words, flags ${flags}, real ${real} (${(real / flags * 100).toFixed(0)}%), false ${flags - real} = ${((flags - real) / words * 1e4).toFixed(3)} per 10k; typos found ${found}/${tried} (${(found / tried * 100).toFixed(1)}%), right name ${right}`)
    if (label === 'shipped') { console.log('   ' + per.join(' ')); for (const e of examples) console.log('   ' + e) }
    if (label !== 'shipped') continue
    // The figures, kept: under one false alarm in 10,000 words (the issue's bar), and nine typos in ten found.
    if ((flags - real) / words * 1e4 > 1) throw new Error('more than one false alarm in 10,000 words')
    if (found / tried < 0.85) throw new Error('fewer than 85% of typos found')
  }
})
