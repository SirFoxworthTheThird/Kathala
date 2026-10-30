import 'fake-indexeddb/auto'
import { describe, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '../src/db/database'
import { importWorldFromJson } from '../src/lib/exportImport'
import { computeInWorldDays } from '../src/lib/inWorldTime'
import { mentionSpans } from '../src/lib/manuscript'
import { sceneBody } from '../src/lib/sceneHeader'
import { SAID, inSentence, sentences } from '../src/lib/headerSuggest'

/**
 * The measurement for Part F1 (next-plan.md): ages stated in the prose,
 * checked against each other and against the book's dates. Part 4 measured
 * the check against birth dates and could not ship it: 1 book in 50 records
 * any. Most books state ages, so this reads the statements themselves.
 *
 * Not a test: it reads the Library, which is not part of this repository, and
 * asserts nothing. Three shapes of statement are read, each kept apart so its
 * own precision can be judged:
 *
 * - `appositive`: "Hal Oduya, sixty-four, …"
 * - `predicate`: "Hal was sixty-four years old", "… is twenty years of age"
 * - `said`: "I'm sixty-four," said Hal — the speaker named in the sentence
 *
 * An approximation ("nearly", "about", "over") is not a statement of age. Two
 * statements about one person are a contradiction when the ages differ from
 * what the time between their scenes allows by more than a year and a half
 * (a birthday falls somewhere between them). Every contradiction is printed
 * with both sentences, to be read by a person: the plan's gate is 9 in 10 real.
 *
 *   KATHALA_LIBRARY=… PROBE_OUT=ages.txt npm run probe:ages
 */

const LIBRARY = join(process.env.KATHALA_LIBRARY ?? '../Kathala-Library', 'library')
const OUT = process.env.PROBE_OUT ?? 'ages-probe.txt'
const LOCAL = ['docs/records', 'e2e/fixtures']

const UNITS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const UNIT = Object.keys(UNITS).join('|')
const TEN = Object.keys(TENS).join('|')
/** A number of years, in figures or words: "64", "sixty-four", "sixty four", "nineteen". */
const NUM = `(\\d{1,3}|(?:${TEN})(?:[-\\s](?:${UNIT}))?|${UNIT})`

function number(text: string): number | null {
  const t = text.toLowerCase().trim()
  if (/^\d+$/.test(t)) return Number(t)
  const [a, b] = t.split(/[-\s]/)
  if (b === undefined) return UNITS[a] ?? TENS[a] ?? null
  return TENS[a] !== undefined && UNITS[b] !== undefined && UNITS[b] < 10 ? TENS[a] + UNITS[b] : null
}

const APPOSITIVE = new RegExp(`^,\\s*(?:aged\\s+)?${NUM}(?:\\s+years?\\s+old)?\\s*[,.;:—–)]`, 'i')
const PREDICATE = new RegExp(`^\\s+(?:was|is|had\\s+turned|turned|has\\s+turned)\\s+(?:now\\s+|just\\s+|only\\s+|then\\s+)?${NUM}\\s+years?\\s+(?:old|of\\s+age)\\b`, 'i')
const SELF = new RegExp(`\\bI(?:'m|’m|\\s+am)\\s+(?:now\\s+|just\\s+|only\\s+)?${NUM}(?:\\s+years?\\s+old)?\\b(?![-\\s]*(?:per|percent|miles|feet|pounds|minutes|hours|days|weeks|months|o'clock))`, 'i')
/** An age anywhere in a sentence: "sixteen years old", "aged fifty", "a man of forty", "a twelve-year-old". */
const AGE_PHRASE = new RegExp(`\\b(?:${NUM}\\s+years?\\s+(?:old|of\\s+age)|aged\\s+${NUM}|an?\\s+(?:man|woman|boy|girl|child|lad|lass|youth|fellow)\\s+of\\s+${NUM}|${NUM}-years?-old)\\b`, 'i')
const APPROX = /\b(?:nearly|almost|about|around|over|under|some|perhaps|maybe|past|close\s+to|more\s+than|less\s+than)\s*$/i

type Kind = 'appositive' | 'predicate' | 'said' | 'sentence'
interface Statement { characterId: string; name: string; age: number; eventId: string; day: number | undefined; flashback: boolean; kind: Kind; sentence: string; chapter: number }

interface BookResult { name: string; statements: Statement[]; contradictions: Array<[Statement, Statement, number]> }

async function probe(name: string, json: string): Promise<BookResult> {
  await Promise.all(db.tables.map((t) => t.clear()))
  const worldId = await importWorldFromJson(json)
  const [events, chapters, timelines, world, characters, markers, items, texts] = await Promise.all([
    db.events.where('worldId').equals(worldId).toArray(),
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.timelines.where('worldId').equals(worldId).toArray(),
    db.worlds.get(worldId),
    db.characters.where('worldId').equals(worldId).toArray(),
    db.locationMarkers.where('worldId').equals(worldId).toArray(),
    db.items.where('worldId').equals(worldId).toArray(),
    db.sceneTexts.where('worldId').equals(worldId).toArray(),
  ])
  const dayOf = computeInWorldDays(events, chapters, timelines, { pinsSetClock: world?.pinsSetClock })
  const cal = world?.calendar
  const yearLength = cal?.months?.length ? cal.months.reduce((n, m) => n + m.days, 0) : 365.25
  const others = [...markers, ...items].map((t) => t.name)
  const numberOf = new Map(chapters.map((c) => [c.id, c.number]))
  const nameOf = new Map(characters.map((c) => [c.id, c.name]))
  const statements: Statement[] = []
  for (const t of texts) {
    const ev = events.find((e) => e.id === t.eventId)
    if (!ev) continue
    const text = sceneBody(t.text ?? '')
    const named = mentionSpans(text, characters, others)
    for (const s of sentences(text)) {
      const people = inSentence(named, s)
      const add = (characterId: string, raw: string, kind: Kind, before: string) => {
        const age = number(raw)
        if (age === null || age < 1 || age > 120 || APPROX.test(before)) return
        statements.push({ characterId, name: nameOf.get(characterId) ?? '?', age, eventId: ev.id, day: dayOf.get(ev.id), flashback: ev.isFlashback, kind, sentence: s.text.trim().replace(/\s+/g, ' ').slice(0, 220), chapter: numberOf.get(ev.chapterId) ?? 0 })
      }
      for (const n of people) {
        const after = s.text.slice(n.at + n.length)
        const a = APPOSITIVE.exec(after)
        if (a) add(n.id, a[1], 'appositive', '')
        const p = PREDICATE.exec(after)
        if (p) add(n.id, p[1], 'predicate', after.slice(0, p.index + p[0].indexOf(p[1])))
      }
      // Any age in a sentence that names one person and no other, said by nobody: theirs, perhaps.
      const phrase = AGE_PHRASE.exec(s.text)
      const ids = [...new Set(people.map((n) => n.id))]
      if (phrase && ids.length === 1 && !SELF.test(s.text)) {
        const raw = phrase.slice(1).find((g) => g !== undefined)!
        add(ids[0], raw, 'sentence', s.text.slice(0, phrase.index))
      }
      const self = SELF.exec(s.text)
      if (self) {
        // The speaker: the one person named in the sentence with speech said of them.
        const speakers = people.filter((n) => SAID.test(s.text.slice(Math.max(0, n.at - 24), n.at + n.length + 24)))
        const ids = [...new Set(speakers.map((n) => n.id))]
        if (ids.length === 1) add(ids[0], self[1], 'said', s.text.slice(0, self.index + self[0].indexOf(self[1])))
      }
    }
  }
  const contradictions: BookResult['contradictions'] = []
  const byPerson = new Map<string, Statement[]>()
  for (const st of statements) if (st.day !== undefined && !st.flashback) byPerson.set(st.characterId, [...(byPerson.get(st.characterId) ?? []), st])
  for (const list of byPerson.values()) {
    list.sort((a, b) => a.day! - b.day!)
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i], b = list[i + 1]
      const years = (b.day! - a.day!) / yearLength
      const off = (b.age - a.age) - years
      if (Math.abs(off) > 1.5) contradictions.push([a, b, off])
    }
  }
  return { name, statements, contradictions }
}

describe('ages probe', () => {
  it('reads stated ages in every book and checks them against each other and the dates', async () => {
    if (!existsSync(LIBRARY)) throw new Error(`No library at ${LIBRARY}.`)
    const files = [
      ...readdirSync(LIBRARY).filter((f) => f.endsWith('.pwk')).sort().map((f) => join(LIBRARY, f)),
      ...LOCAL.flatMap((dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.pwk')).sort().map((f) => join(dir, f)) : [])),
    ]
    const results: BookResult[] = []
    const failed: string[] = []
    for (const file of files) {
      const name = file.replace(/^.*\//, '').replace('.pwk', '')
      try { results.push(await probe(name, readFileSync(file, 'utf8'))) } catch (err) { failed.push(`${name}: ${String(err).split('\n')[0]}`) }
    }
    const all = results.flatMap((b) => b.statements.map((s) => ({ book: b.name, ...s })))
    const kinds: Kind[] = ['appositive', 'predicate', 'said', 'sentence']
    const people = new Set(all.map((s) => `${s.book}/${s.characterId}`))
    const twice = [...people].filter((p) => all.filter((s) => `${s.book}/${s.characterId}` === p).length >= 2)
    const flagged = results.flatMap((b) => b.contradictions.map((c) => ({ book: b.name, c })))
    // Every 7th statement, for reading whether it is the person's age at all.
    const sample = all.filter((_, i) => i % 3 === 0).slice(0, 60)
    const report = [
      `${results.length} books read${failed.length ? `, ${failed.length} not read` : ''}`,
      `statements: ${all.length} (${kinds.map((k) => `${k} ${all.filter((s) => s.kind === k).length}`).join(', ')}) about ${people.size} people in ${new Set(all.map((s) => s.book)).size} books`,
      `people with two or more statements: ${twice.length}`,
      `contradictions flagged: ${flagged.length}`,
      '',
      '=== CONTRADICTIONS (every one, to be read) ===',
      ...flagged.flatMap(({ book, c: [a, b, off] }) => [
        `[${book}] ${a.name}: ${a.age} in Ch. ${a.chapter} (day ${a.day}), ${b.age} in Ch. ${b.chapter} (day ${b.day}) — off by ${off.toFixed(1)} years`,
        `    ${a.kind}: ${a.sentence}`,
        `    ${b.kind}: ${b.sentence}`,
      ]),
      '',
      '=== A SAMPLE OF STATEMENTS (is it this person’s age?) ===',
      ...sample.map((s) => `[${s.book}] ${s.kind} ${s.name} = ${s.age}: ${s.sentence}`),
      ...(failed.length ? ['', '=== NOT READ ===', ...failed] : []),
    ].join('\n')
    writeFileSync(OUT, `${report}\n`)
    process.stdout.write(`${report.split('\n').slice(0, 5).join('\n')}\n\nprobe: written to ${OUT}\n`)
  })
})
