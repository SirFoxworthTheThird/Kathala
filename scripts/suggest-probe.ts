import 'fake-indexeddb/auto'
import { describe, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '../src/db/database'
import { importWorldFromJson } from '../src/lib/exportImport'
import { storyOf } from '../src/lib/stateEngine'
import { wholeRecords } from '../src/lib/personState'
import { mentionSpans, type NameSpan } from '../src/lib/manuscript'
import { recordBeforeIn, recordsPerScene, sceneBody, sceneFates } from '../src/lib/sceneHeader'
import { inSentence, sentences, speakers, suggestCast } from '../src/lib/headerSuggest'
import { computeInWorldDays } from '../src/lib/inWorldTime'

/**
 * The precision probe for Part D (next-plan.md): header lines suggested from
 * a scene's prose, against the headers the Library's curators wrote.
 *
 * Not a test: it reads the Library, which is not part of this repository, and
 * asserts nothing. The books alternate between a set the rules were tuned on
 * and a set held out from tuning, reported apart; the writer runs' own books
 * (`docs/records/*.pwk`) are a third set, written by writers rather than
 * curated. Over every scene with prose, each rule is scored as precision (of
 * what it suggested, how much the curators had) and recall (of what they had,
 * how much it suggested). A `line` rule is scored by the whole suggestion, as
 * one key accepts it: right only if every name on it is the curators'.
 *
 * The app offers only `cast: speaks≥2` (`suggestCast`). The rest are what was
 * tried and not shipped, kept here so the measurement can be run again:
 *
 * - `cast: named≥3` — the checker's rule for a name not in the cast, as a
 *   suggestion; `speaks≥1`, speech said of them once.
 * - `place` — the place named most in the prose.
 * - `handoff` — an item named after a giving verb, to the one person named
 *   after it in the same sentence.
 * - `death` — a death said outright of somebody named, and alive by the
 *   records before the scene.
 *
 * And Part D2's, none shipped:
 *
 * - `when` — the days an opening phrase says ("two days later", "the next
 *   morning") against the days since the scene before on its timeline.
 * - `same place`, `same cast` — the scene before's in its chapter: `still`
 *   where the opening has nobody going anywhere, `any` everywhere, for scale.
 *
 *   npm run probe:suggest
 *   KATHALA_LIBRARY=../elsewhere PROBE_OUT=suggest.txt npm run probe:suggest
 */

const LIBRARY = join(process.env.KATHALA_LIBRARY ?? '../Kathala-Library', 'library')
const OUT = process.env.PROBE_OUT ?? 'suggest-probe.txt'
const WRITERS = 'docs/records'

const RULES = ['cast: speaks≥2', 'line: speaks≥2', 'cast: speaks≥1', 'line: speaks≥1', 'cast: named≥3', 'place', 'handoff', 'death', 'when', 'same place: still', 'same place: any', 'same cast: still', 'same cast: any'] as const
type Rule = (typeof RULES)[number]
interface Count { tp: number; fp: number; fn: number }
type BookSet = 'tuned' | 'held out' | 'writers'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Where each thing is named, by its whole name (an article leading it in either case), longest names first. */
function thingSpans(text: string, things: readonly { id: string; name: string }[]): Map<string, NameSpan[]> {
  const out = new Map<string, NameSpan[]>()
  const taken: Array<[number, number]> = []
  for (const t of [...things].filter((t) => t.name.trim()).sort((a, b) => b.name.length - a.name.length)) {
    const words = t.name.trim().split(/\s+/)
    const lead = /^(the|a|an)$/i.test(words[0]) ? `(?:${escape(words[0])}|${escape(words[0].toLowerCase())})\\s+` : ''
    const re = new RegExp(`\\b${lead}${(lead ? words.slice(1) : words).map(escape).join('\\s+')}\\b`, 'g')
    for (const m of text.matchAll(re)) {
      const end = m.index + m[0].length
      if (taken.some(([a, b]) => m.index < b && end > a)) continue
      taken.push([m.index, end])
      out.set(t.id, [...(out.get(t.id) ?? []), { at: m.index, length: m[0].length }])
    }
  }
  return out
}

const GIVE = /\b(?:gave|given|handed|hands|passed|passes|lent|entrusted|delivered|bequeathed|returned|surrendered)\b/
const DIES = /^\s*(?:,[^,]{0,40},\s*)?(?:died|dies|was\s+(?:killed|slain|murdered|hanged|executed|drowned|dead)|is\s+dead|lay\s+dead|fell\s+dead|perished|breathed\s+(?:his|her|their)\s+last)\b/
const KILLS = /\b(?:killed|slew|murdered|executed)\s*$/

/*
  D2's rules (next-plan.md): how long after the scene before a scene's opening
  says it is, and whether anybody goes anywhere in it. Neither passed, so
  they are here rather than in the app.
*/
/** A scene's opening: its first paragraph, where a book says when and where a scene is. */
function opening(text: string): string {
  return text.trim().split(/\n\s*\n/)[0] ?? ''
}

const NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, few: 3, several: 3, couple: 2,
}
const COUNT = `(\\d+|${Object.keys(NUMBERS).join('|')})`

/** How many days a phrase of the opening puts the scene after the one before, as a `When:` line says it. */
interface WhenFromProse { days: number; said: string }

/** The patterns, most particular first: the first to match in the opening is the one read. */
const PHRASES: Array<{ re: RegExp; days: (m: RegExpExecArray) => number | null }> = [
  { re: new RegExp(`\\b(?:a\\s+)?${COUNT}\\s+(?:of\\s+)?days?\\s+(?:later|after(?:wards?)?|passed|went\\s+by)\\b`, 'i'), days: (m) => count(m[1]) },
  { re: new RegExp(`\\b(?:a\\s+)?${COUNT}\\s+weeks?\\s+(?:later|after(?:wards?)?|passed|went\\s+by)\\b`, 'i'), days: (m) => mult(count(m[1]), 7) },
  { re: /\ba\s+fortnight\s+(?:later|after(?:wards?)?|passed)\b/i, days: () => 14 },
  { re: /\b(?:the\s+)?(?:next|following)\s+(?:day|morning|evening|afternoon|night)\b|\bthe\s+day\s+after\b|\btomorrow\s+came\b/i, days: () => 1 },
  { re: /\b(?:that\s+(?:same\s+)?(?:evening|afternoon|night)|later\s+that\s+(?:day|morning|evening|afternoon|night)|the\s+same\s+(?:day|evening|night))\b/i, days: () => 0 },
]

function count(word: string): number | null {
  const n = /^\d+$/.test(word) ? Number(word) : NUMBERS[word.toLowerCase()]
  return n === undefined ? null : n
}
const mult = (n: number | null, by: number) => (n === null ? null : n * by)

/** How long after the scene before this one is, as its opening says; null where it says nothing a `When:` line can hold. */
function whenFromProse(text: string): WhenFromProse | null {
  const first = opening(text)
  for (const { re, days } of PHRASES) {
    const m = re.exec(first)
    if (!m) continue
    const d = days(m)
    if (d !== null) return { days: d, said: m[0] }
  }
  return null
}

/** Verbs of somebody going somewhere, or coming. */
const MOVES = /\b(?:went|goes|go(?:ing)?\s+(?:to|into|out|down|up|back|home)|came|comes|arrived?|arrives|arriving|left|leaves|leaving|rode|rides|walked|walks|ran|drove|sailed|travell?ed|journeyed|returned|returns|reached|reaches|entered|enters|set\s+(?:out|off)|departed|fled|crossed|climbed|followed|hurried|hastened|made\s+(?:his|her|their|my|our)\s+way)\b/i

/** Whether the scene's opening has anybody going anywhere: if not, it is likely where the scene before was. */
function openingMoves(text: string): boolean {
  return MOVES.test(opening(text))
}

interface BookResult { name: string; set: BookSet; scenes: number; counts: Record<Rule, Count>; samples: string[] }

async function probe(name: string, json: string, set: BookSet): Promise<BookResult> {
  await Promise.all(db.tables.map((t) => t.clear()))
  const worldId = await importWorldFromJson(json)
  const [events, chapters, timelines, world, characters, markers, items, texts, records, custody] = await Promise.all([
    db.events.where('worldId').equals(worldId).toArray(),
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.timelines.where('worldId').equals(worldId).toArray(),
    db.worlds.get(worldId),
    db.characters.where('worldId').equals(worldId).toArray(),
    db.locationMarkers.where('worldId').equals(worldId).toArray(),
    db.items.where('worldId').equals(worldId).toArray(),
    db.sceneTexts.where('worldId').equals(worldId).toArray(),
    db.characterSnapshots.where('worldId').equals(worldId).toArray(),
    db.itemCustody.where('worldId').equals(worldId).toArray(),
  ])
  const story = storyOf(events, chapters, timelines, { pinsSetClock: world?.pinsSetClock })
  // Each scene's day, and the days since the scene before it on its timeline in the book's order: what a When: line of days says.
  const dayOf = computeInWorldDays(events, chapters, timelines, { pinsSetClock: world?.pinsSetClock })
  const chapterNo = new Map(chapters.map((c) => [c.id, c.number]))
  const ordered = [...events].sort((a, b) => (chapterNo.get(a.chapterId) ?? 0) - (chapterNo.get(b.chapterId) ?? 0) || a.sortOrder - b.sortOrder)
  const sinceBefore = new Map<string, number>()
  for (const t of timelines) {
    const on = ordered.filter((e) => e.timelineId === t.id)
    on.forEach((e, i) => {
      const day = dayOf.get(e.id)
      const was = i > 0 ? dayOf.get(on[i - 1].id) : undefined
      if (day !== undefined && was !== undefined) sinceBefore.set(e.id, Math.round(day - was))
    })
  }
  const whole = wholeRecords(records, story)
  const before = recordBeforeIn(story)
  const ofScene = recordsPerScene(whole)
  const everyone = characters.map((c) => c.id)
  const others = [...markers, ...items].map((t) => t.name)
  const nameOf = new Map<string, string>([...characters, ...markers, ...items].map((x) => [x.id, x.name]))
  const textOf = new Map(texts.map((t) => [t.eventId, sceneBody(t.text ?? '')]))

  const counts = Object.fromEntries(RULES.map((r) => [r, { tp: 0, fp: 0, fn: 0 }])) as Record<Rule, Count>
  const samples: string[] = []
  let scenes = 0
  for (const ev of events) {
    const text = textOf.get(ev.id)
    if (!text?.trim()) continue
    scenes++
    const cast = new Set(ev.involvedCharacterIds)
    const score = (rule: Rule, said: Set<string>, truth: Set<string>) => {
      for (const x of said) if (truth.has(x)) counts[rule].tp++; else counts[rule].fp++
      for (const x of truth) if (!said.has(x)) counts[rule].fn++
    }
    const line = (rule: Rule, said: Set<string>) => {
      if (said.size === 0) counts[rule].fn++
      else if ([...said].every((x) => cast.has(x))) counts[rule].tp++
      else counts[rule].fp++
    }

    // Who is there. From scratch, as for a scene with no header yet: nobody accounted for.
    const shipped = new Set(suggestCast(text, characters, [], others))
    score('cast: speaks≥2', shipped, cast)
    line('line: speaks≥2', shipped)
    const once = new Set([...speakers(text, characters, others)].filter(([, n]) => n >= 1).map(([id]) => id))
    score('cast: speaks≥1', once, cast)
    line('line: speaks≥1', once)
    const named = mentionSpans(text, characters, others)
    score('cast: named≥3', new Set([...named].filter(([, s]) => s.length >= 3).map(([id]) => id)), cast)
    for (const id of shipped) if (!cast.has(id) && samples.length < 8) samples.push(`${ev.title}: @@${nameOf.get(id)} — not in the curated cast`)

    // Where it is: the place named most, the first named breaking a tie.
    const places = [...thingSpans(text, markers)].sort((a, b) => b[1].length - a[1].length || a[1][0].at - b[1][0].at)
    score('place', new Set(places.length ? [places[0][0]] : []), new Set(ev.locationMarkerId ? [ev.locationMarkerId] : []))

    // Hand-offs and deaths, sentence by sentence.
    const handed = new Set(custody.filter((c) => c.eventId === ev.id && c.holderId && c.has === undefined).map((c) => `${c.itemId}>${c.holderId}`))
    const died = new Set(sceneFates(ev.id, everyone, ofScene(ev.id), [], before).dead)
    const aliveBefore = (id: string) => {
      const b = before(whole.filter((r) => r.characterId === id && r.eventId !== ev.id), ev.id)
      return !b || b.isAlive !== false
    }
    const itemSpans = thingSpans(text, items)
    const gives = new Set<string>()
    const deaths = new Set<string>()
    for (const s of sentences(text)) {
      const people = inSentence(named, s)
      const give = GIVE.exec(s.text)
      if (give) {
        const things = inSentence(itemSpans, s).filter((t) => t.at > give.index)
        const to = people.filter((n) => n.at > give.index)
        if (things.length === 1 && to.length === 1) gives.add(`${things[0].id}>${to[0].id}`)
      }
      for (const n of people) {
        if ((DIES.test(s.text.slice(n.at + n.length)) || KILLS.test(s.text.slice(0, n.at))) && aliveBefore(n.id)) deaths.add(n.id)
      }
    }
    score('handoff', gives, handed)
    score('death', deaths, died)

    // D2. When: the days an opening phrase says, against the scene's curated days since the one before (unpinned scenes only).
    const since = sinceBefore.get(ev.id)
    if (since !== undefined) {
      const w = whenFromProse(text)
      score('when', new Set(w ? [String(w.days)] : []), new Set([String(since)]))
      if (w && w.days !== since && whenSamples.length < 12) whenSamples.push(`${name} · ${ev.title}: “${w.said}” read as ${w.days}, curated ${since}`)
    }
    // D2. The scene before in its chapter: its place and cast, offered where the opening has nobody moving — and, for scale, everywhere.
    const prior = events.filter((e) => e.chapterId === ev.chapterId && e.sortOrder < ev.sortOrder).sort((a, b) => b.sortOrder - a.sortOrder)[0]
    if (prior) {
      const still = !openingMoves(text)
      const placeSaid = new Set(prior.locationMarkerId ? [prior.locationMarkerId] : [])
      const placeTrue = new Set(ev.locationMarkerId ? [ev.locationMarkerId] : [])
      const castLine = (rule: Rule) => {
        if (prior.involvedCharacterIds.length === 0) { counts[rule].fn++; return }
        const same = prior.involvedCharacterIds.every((id) => cast.has(id))
        if (same) counts[rule].tp++; else counts[rule].fp++
      }
      score('same place: any', placeSaid, placeTrue)
      castLine('same cast: any')
      if (still) { score('same place: still', placeSaid, placeTrue); castLine('same cast: still') }
    }
  }
  return { name, set, scenes, counts, samples }
}

const whenSamples: string[] = []
const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((100 * n) / d)}%`).padStart(5)

describe('suggest probe', () => {
  it('measures header suggestions from prose against the Library’s curated headers', async () => {
    if (!existsSync(LIBRARY)) throw new Error(`No library at ${LIBRARY}. Clone SirFoxworthTheThird/Kathala-Library beside this repository, or set KATHALA_LIBRARY.`)
    const library = readdirSync(LIBRARY).filter((f) => f.endsWith('.pwk')).sort()
    const files: Array<{ path: string; set: BookSet }> = [
      // Alternate books: the rules were tuned on the even ones only.
      ...library.map((f, i) => ({ path: join(LIBRARY, f), set: (i % 2 === 0 ? 'tuned' : 'held out') as BookSet })),
      ...(existsSync(WRITERS) ? readdirSync(WRITERS).filter((f) => f.endsWith('.pwk')).sort().map((f) => ({ path: join(WRITERS, f), set: 'writers' as const })) : []),
    ]
    const results: BookResult[] = []
    const failed: string[] = []
    for (const { path, set } of files) {
      const name = path.replace(/^.*\//, '').replace('.pwk', '')
      try { results.push(await probe(name, readFileSync(path, 'utf8'), set)) } catch (err) { failed.push(`${name}: ${String(err).split('\n')[0]}`) }
    }
    const lines: string[] = []
    for (const set of ['tuned', 'held out', 'writers'] as const) {
      const books = results.filter((b) => b.set === set)
      lines.push(`${set}: ${books.length} books, ${books.reduce((n, b) => n + b.scenes, 0)} scenes with prose`)
      lines.push(`  ${'rule'.padEnd(16)} ${'prec'.padStart(5)} ${'rec'.padStart(5)}   tp/fp/fn`)
      for (const r of RULES) {
        const t = books.reduce((c, b) => ({ tp: c.tp + b.counts[r].tp, fp: c.fp + b.counts[r].fp, fn: c.fn + b.counts[r].fn }), { tp: 0, fp: 0, fn: 0 })
        lines.push(`  ${r.padEnd(16)} ${pct(t.tp, t.tp + t.fp)} ${pct(t.tp, t.tp + t.fn)}   ${t.tp}/${t.fp}/${t.fn}`)
      }
    }
    const report = [
      `${results.length} worlds probed${failed.length ? `, ${failed.length} not read` : ''}`,
      ...lines,
      ...(failed.length ? ['', '=== NOT READ ===', ...failed] : []),
      '',
      '=== WHEN, READ OTHER THAN CURATED ===',
      ...whenSamples.map((s) => `  ${s}`),
      '',
      '=== SUGGESTED, NOT CURATED (cast: speaks≥2) ===',
      ...results.filter((b) => b.samples.length).flatMap((b) => [`[${b.name}] (${b.set})`, ...b.samples.map((s) => `  ${s}`)]),
    ].join('\n')
    writeFileSync(OUT, `${report}\n`)
    process.stdout.write(`${lines.join('\n')}\n\nprobe: written to ${OUT}\n`)
  })
})
