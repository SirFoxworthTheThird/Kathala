/*
  A paste whose headings the Page has not finished making.

  Pasted `## ` and `# ` lines are made into scenes and chapters one at a time,
  from the bottom up, each its own write (`revisitLeft` in DraftBook). Until a
  line's turn comes it is a line of the scene the paste landed in, and that
  scene is saved with it: a page closed part-way kept the lines not yet made as
  prose for good — a `## Title` and its header block in the middle of a scene,
  read by nothing and exported as text. The close-anywhere harness found it
  (`e2e/closeAnywhere.spec.ts`, next-plan.md Part A).

  So the lines a paste brings are remembered here, synchronously, as it lands,
  and forgotten once the last is made. A page that opens to find them owed
  makes those still on it, as the paste would have. Only those lines: a `## `
  line in a scene's prose that came from a scene card stays text, as it always
  has. Per browser, like the header lines kept beside it; never world data.
*/

const KEY = 'kathala-owed-paste'

export interface OwedPaste {
  /** The heading lines the paste brought, as typed: `## Title`, `# Title`. */
  lines: string[]
  /** Whether the paste ended the timeline: see `pastedAtEnd`. */
  atEnd: boolean
}

function readAll(): Record<string, OwedPaste> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, OwedPaste>) : {}
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, OwedPaste>) {
  try {
    if (Object.keys(all).length) localStorage.setItem(KEY, JSON.stringify(all))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the paste is made by this visit, as it always was.
  }
}

/** Remember the heading lines of a paste in `worldId`, with any still owed from an earlier one there. Never throws. */
export function owePaste(worldId: string, lines: readonly string[], atEnd: boolean) {
  const all = readAll()
  const earlier = all[worldId]
  all[worldId] = { lines: [...new Set([...(earlier?.lines ?? []), ...lines])], atEnd: earlier ? earlier.atEnd : atEnd }
  writeAll(all)
}

/** What is owed in `worldId`, if anything. */
export function owedPaste(worldId: string): OwedPaste | null {
  return readAll()[worldId] ?? null
}

/** Every heading of the paste is made: nothing is owed in `worldId`. */
export function paidPaste(worldId: string) {
  const all = readAll()
  if (!(worldId in all)) return
  delete all[worldId]
  writeAll(all)
}
