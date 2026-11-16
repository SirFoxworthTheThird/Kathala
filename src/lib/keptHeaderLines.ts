/*
  Header lines kept as typed because they name something the world has not got.

  A scene's header line is drawn from its records and never stored, so a line
  naming somebody or somewhere unknown — `[#The Larder]` before there is a
  larder — was kept only in memory, for its spelling to be fixed on the line. A
  reload took the line and its warning away and recorded nothing: a writer run
  typed a new place in a header, reloaded, and found no sign of it.

  So such a line is remembered here, with what it could not answer, until it is
  applied cleanly or deleted. Per browser, like the other things a page keeps
  for its writer between visits; it is never world data.
*/

import type { AmbiguousPlace } from './sceneHeader'

const KEY = 'kathala-kept-headers'

export interface KeptLine {
  line: string
  /**
   * `facts`: fact titles nothing answers, from a Facts line — absent on lines kept before there was one.
   * `items`: item names nothing answers, from an Items line — likewise absent on older lines.
   * `people`: names on a Relationships or Facts line nobody answers to — the note offers to make them.
   * `refused`: what the line asks that the rules do not allow, said as sentences — a reveal of somebody as themself.
   * `ambiguous`: place names more than one place answers to — the note lists them.
   */
  unknown: { names: string[]; place: string | null; facts?: string[]; items?: string[]; people?: string[]; refused?: string[]; ambiguous?: AmbiguousPlace[] }
}

function readAll(): Record<string, KeptLine> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, KeptLine>) : {}
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, KeptLine>) {
  try {
    if (Object.keys(all).length) localStorage.setItem(KEY, JSON.stringify(all))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the line is kept for this visit, as it always was.
  }
}

export function keptLines(): Record<string, KeptLine> {
  return readAll()
}

export function keptLine(eventId: string): KeptLine | null {
  return readAll()[eventId] ?? null
}

export function keepLine(eventId: string, kept: KeptLine) {
  writeAll({ ...readAll(), [eventId]: kept })
}

export function forgetLine(eventId: string) {
  const all = readAll()
  if (!(eventId in all)) return
  delete all[eventId]
  writeAll(all)
}

/** "A", "A and B", "A, B and C". */
function listed(names: readonly string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * What a paste says of the scenes whose headers it left waiting, when there
 * is more than one: the note under it speaks for a single scene, and the rest
 * were found only by visiting each header (writer run 11). Nothing for one,
 * which the note itself is about.
 */
export function keptByPaste(titles: readonly string[]): string | null {
  if (titles.length < 2) return null
  return `The headers of ${listed(titles.map((t) => `“${t}”`))} were not applied, and wait as typed.`
}

/** The sentence `keptByPaste` writes, wherever it stands in a notice. */
const KEPT_BY_PASTE = /\s*The headers of .*? were not applied, and wait as typed\./

/**
 * A notice with what it says of the paste's waiting headers put right: the
 * titles still waiting, or nothing where none are (round-trip-plan-4.md,
 * T21.1). After Create all had made what they named and applied every one,
 * the note still said they "were not applied, and wait as typed" (writer run,
 * W3-11).
 */
export function withKeptByPaste(notice: string | null, stillWaiting: readonly string[]): string | null {
  if (!notice) return notice
  const said = keptByPaste(stillWaiting)
  const rest = notice.replace(KEPT_BY_PASTE, '').trim()
  if (!KEPT_BY_PASTE.test(notice)) return notice
  return said ? (rest ? `${rest} ${said}` : said) : rest || null
}

/** What Create all will make for the waiting headers, each name once. */
export interface ToMake { people: string[]; places: string[]; items: string[]; facts: string[] }

/** What Create all will make, gathered from each waiting header's plan: each name once, in the order met. */
export function toMake(unknowns: ReadonlyArray<KeptLine['unknown']>): ToMake {
  const once = (names: Array<string | null | undefined>) => [...new Set(names.filter((n): n is string => !!n))]
  return {
    people: once(unknowns.flatMap((u) => u.people ?? [])),
    places: once(unknowns.map((u) => u.place)),
    items: once(unknowns.flatMap((u) => u.items ?? [])),
    facts: once(unknowns.flatMap((u) => u.facts ?? [])),
  }
}

/**
 * Create all's label (round-trip-plan-4.md, T21.1, D-15): the people it will
 * make, by name, before the click, since a misspelt name on a Cast line
 * would become a second person; then how many places, items and facts.
 * *Create Anna Brisk, Bo Tallis and Cara Lind, and 2 places*. Null where it
 * would make nothing.
 */
export function createAllLabel(m: ToMake): string | null {
  const count = (n: number, one: string, many: string) => (n ? [`${n} ${n === 1 ? one : many}`] : [])
  const rest = [...count(m.places.length, 'place', 'places'), ...count(m.items.length, 'item', 'items'), ...count(m.facts.length, 'fact', 'facts')]
  if (!m.people.length && !rest.length) return null
  if (!m.people.length) return `Create ${listed(rest)}`
  return `Create ${listed(m.people)}${rest.length ? `, and ${listed(rest)}` : ''}`
}

/**
 * The sentence the page and a scene card say about a line kept as typed, and
 * what the scene holds `now` — read from its records, not from the line.
 *
 * It used to say "the cast was left as it was", which a writer run read as
 * "nothing changed": but a name picked from the list in the brackets is put in
 * the scene as it is picked, before the line is left, so three scenes ended up
 * with six or seven people under a note saying none had been touched. Saying
 * who is there is true whichever way they got there.
 */
export function keptLineWarning(
  unknown: KeptLine['unknown'],
  now: { cast: readonly string[]; place: string | null },
): string {
  const names = [...unknown.names, ...(unknown.place ? [unknown.place] : []), ...(unknown.facts ?? []), ...(unknown.items ?? [])].map((n) => `“${n}”`).join(' or ')
  // The setting is said when the Place line was not applied: a name nothing answers, or one several places do.
  const placeHeld = unknown.place !== null || !!unknown.ambiguous?.some((a) => a.line === 'place')
  const held = [
    ...(unknown.names.length > 0 ? [now.cast.length > 0 ? `In the scene now: ${listed(now.cast)}.` : 'Nobody is in its cast yet.'] : []),
    ...(placeHeld ? [now.place ? `It is still set at ${now.place}.` : 'It has no setting yet.'] : []),
  ]
  const refused = unknown.refused ?? []
  const ambiguous = (unknown.ambiguous ?? []).map(whichPlace)
  if (!names && ambiguous.length) return `${ambiguous.join(' ')} The line was not applied. ${[...held, ...refused].join(' ')}`.trim()
  if (!names) return `${refused.join(' ')} The line was kept as typed, so it can be changed on it.`
  return `Nothing in this world is called ${names} — the line was not applied, so the spelling can be fixed on it. ${[...ambiguous, ...held, ...refused].join(' ')}`.trim()
}

/**
 * What to say of a name several places answer to: how to write each, where
 * their maps tell them apart, and otherwise that one wants another name.
 */
function whichPlace(a: AmbiguousPlace): string {
  const labels = [...new Set(a.choices.map((c) => c.label))]
  if (labels.length === a.choices.length) {
    return `More than one place is called “${a.name}” — write ${labels.map((l) => `“${l}”`).join(' or ')} to say which.`
  }
  const maps = [...new Set(a.choices.map((c) => c.map))]
  const on = maps.length === 1 ? ` on ${maps[0]}` : ''
  return `${a.choices.length === 2 ? 'Two' : 'Several'} places${on} are called “${a.name}” — rename one on Maps to tell them apart.`
}

/**
 * The places the note offers to set the scene at, for a Place line several
 * places answer to: only where each can be told from the others, since two
 * buttons reading the same would be a guess with extra steps.
 */
export function placeChoices(unknown: KeptLine['unknown']): AmbiguousPlace['choices'] {
  const a = unknown.ambiguous?.find((x) => x.line === 'place')
  if (!a || new Set(a.choices.map((c) => c.label)).size !== a.choices.length) return []
  return a.choices
}
