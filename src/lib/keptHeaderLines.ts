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

const KEY = 'kathala-kept-headers'

export interface KeptLine {
  line: string
  unknown: { names: string[]; place: string | null }
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
  const names = [...unknown.names, ...(unknown.place ? [unknown.place] : [])].map((n) => `“${n}”`).join(' or ')
  const held = [
    ...(unknown.names.length > 0 ? [now.cast.length > 0 ? `In the scene now: ${listed(now.cast)}.` : 'Nobody is in its cast yet.'] : []),
    ...(unknown.place !== null ? [now.place ? `It is still set at ${now.place}.` : 'It has no setting yet.'] : []),
  ]
  return `Nothing in this world is called ${names} — the line was not applied, so the spelling can be fixed on it. ${held.join(' ')}`
}
