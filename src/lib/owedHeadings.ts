/*
  Headings the Page has been given and not yet made.

  A `## ` or `# ` line typed and left, or pasted, is made into a scene or a
  chapter by a write of its own — for a paste, one at a time from the bottom up
  (`revisitLeft` in DraftBook). Until its write lands the line is a line of the
  scene it was typed or pasted in, and that is how a page closed in between
  left it: a `## Title`, and a pasted header block under it, in the middle of a
  scene's prose for good — read by nothing, and exported as text. The
  close-anywhere harness found it (`e2e/closeAnywhere.spec.ts`, next-plan.md
  Part A).

  So each such line is remembered here, synchronously, before anything is
  written, and forgotten once it is made. A page that opens to find lines owed
  makes those still on it, as it would have. Only those lines: a `## ` line in
  a scene's prose that came from a scene card stays text, as it always has.
  Per browser, like the header lines kept beside it; never world data.
*/

const KEY = 'kathala-owed-headings'

export interface OwedHeadings {
  /** The heading lines, as typed: `## Title`, `# Title`. */
  lines: string[]
  /** Whether they came in a paste — made as a paste's are, carrying nothing from the scene they landed in. */
  pasted: boolean
  /** A paste's: whether it ended the timeline (`pastedAtEnd`). */
  atEnd: boolean
}

function readAll(): Record<string, OwedHeadings> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, OwedHeadings>) : {}
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, OwedHeadings>) {
  try {
    if (Object.keys(all).length) localStorage.setItem(KEY, JSON.stringify(all))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the headings are made by this visit, as they always were.
  }
}

/** Remember heading lines owed in `worldId`, with any still owed there from before. Never throws. */
export function oweHeadings(worldId: string, lines: readonly string[], opts: { pasted: boolean; atEnd?: boolean }) {
  if (lines.length === 0) return
  const all = readAll()
  const earlier = all[worldId]
  all[worldId] = {
    lines: [...new Set([...(earlier?.lines ?? []), ...lines])],
    pasted: !!earlier?.pasted || opts.pasted,
    atEnd: earlier ? earlier.atEnd : !!opts.atEnd,
  }
  writeAll(all)
}

/** What is owed in `worldId`, if anything. */
export function owedHeadings(worldId: string): OwedHeadings | null {
  return readAll()[worldId] ?? null
}

/** `lines` are made — or, given none, every line owed in `worldId` is. */
export function paidHeadings(worldId: string, lines?: readonly string[]) {
  const all = readAll()
  const owed = all[worldId]
  if (!owed) return
  const rest = lines ? owed.lines.filter((l) => !lines.includes(l)) : []
  if (rest.length) all[worldId] = { ...owed, lines: rest }
  else delete all[worldId]
  writeAll(all)
}
