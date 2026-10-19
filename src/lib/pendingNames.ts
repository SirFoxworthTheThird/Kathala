import { useState } from 'react'

/**
 * Whoever the "@" picker made and has not yet been asked about to the end —
 * the "other names they go by" lines under the writing — kept across a
 * reload. They lived only in the page's memory, so a writer who reloaded
 * before answering lost the question (writer run 5, U3). Kept the way a header
 * line kept as typed is (`keptHeaderLines`): in this browser, per `scope` — a
 * world's Page, or one scene card.
 */
const KEY = 'kathala-pending-names'

export interface PendingName { id: string; name: string }

function readAll(): Record<string, PendingName[]> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, PendingName[]>) : {}
  } catch {
    return {}
  }
}

function write(scope: string, list: PendingName[]) {
  try {
    const all = readAll()
    if (list.length) all[scope] = list
    else delete all[scope]
    if (Object.keys(all).length) localStorage.setItem(KEY, JSON.stringify(all))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: kept for this visit, as it always was.
  }
}

export function pendingNames(scope: string): PendingName[] {
  return readAll()[scope] ?? []
}

/** The list for `scope`, as state that is written through to storage. */
export function usePendingNames(scope: string): [PendingName[], (next: (all: PendingName[]) => PendingName[]) => void] {
  const [list, setList] = useState<PendingName[]>(() => pendingNames(scope))
  const update = (next: (all: PendingName[]) => PendingName[]) => {
    setList((all) => {
      const changed = next(all)
      write(scope, changed)
      return changed
    })
  }
  return [list, update]
}

/**
 * Who is still to be asked: those who still exist and have no other names
 * yet. Somebody given aliases since — on their Overview, say — has answered
 * the question elsewhere, and a writer run found three of these lines still
 * above the page dozens of sessions on, pushing the book down (writer run 11).
 */
export function stillToAsk(
  pending: readonly PendingName[],
  characters: ReadonlyArray<{ id: string; aliases?: readonly string[] }>,
): PendingName[] {
  return pending.filter((p) => {
    const c = characters.find((x) => x.id === p.id)
    return !!c && (c.aliases ?? []).length === 0
  })
}
