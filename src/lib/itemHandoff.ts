import type { WorldEvent, Chapter, CharacterSnapshot, ItemPlacement } from '@/types'
import { positionLookup } from '@/lib/bookOrder'
import type { Story } from '@/lib/stateEngine'

// Book order, shared with the checker and everything else: see `bookOrder.ts`.
const makeEventOrder = positionLookup

// ── Item hand-off continuity ──────────────────────────────────────────────────

export interface ItemHandoffIssue {
  itemId: string
  fromCharacterId: string
  toCharacterId: string
  /** Where the previous owner last held it. */
  fromMarkerId: string
  /** Where the new owner first holds it. */
  toMarkerId: string
  /** First event where the new owner possesses the item. */
  handoffEventId: string
}

/** One point in an item's possession history: a character holding it, or a
 *  location it was placed at, at a given narrative order. */
interface Entry {
  order: number
  eventId: string
  /** 'c:<charId>' or 'l:<markerId>' — identifies a distinct holder. */
  holderKey: string
  kind: 'char' | 'loc'
  charId: string | null
  markerId: string | null
}

/** A run of consecutive entries with the same holder. */
interface Run {
  kind: 'char' | 'loc'
  charId: string | null
  firstOrder: number
  firstEventId: string
  firstMarkerId: string | null
  lastOrder: number
  lastMarkerId: string | null
}

/**
 * Flags items that change hands directly between two characters who were never
 * in the same place around the hand-off — the classic "teleporting object" bug
 * (a sword that leaves one character's belt and appears on another's across the
 * map, with no scene where they meet).
 *
 * Only *direct* character→character transfers are checked: if the item passes
 * through a location placement (dropped, then picked up) that intermediary
 * breaks the adjacency, so legitimate drop/pickup handoffs are never flagged. A
 * transfer is considered plausible — and skipped — when the two characters share
 * any location during the window spanning the hand-off, so meeting anywhere in
 * between clears it. Locations that are unknown on either side are not judged.
 *
 * Each era is walked on its own (`Story.eraOf`). In a book braided from eras,
 * an item read in 311 AL and then in 742 AL has not been handed from one
 * holder to the other: centuries passed. Writer run 10 drew six "changes
 * hands across a distance" warnings for an item the book carries across three
 * eras on purpose. How it crossed is the item's chain, not a hand-off.
 *
 * Pure and side-effect free.
 */
export function computeItemHandoffIssues({
  events, chapters, snapshots, placements, story,
}: {
  events: WorldEvent[]
  chapters: Chapter[]
  snapshots: CharacterSnapshot[]
  placements: ItemPlacement[]
  /** The book's eras; without it the book is one era. */
  story?: Story
}): ItemHandoffIssue[] {
  const eventOrder = makeEventOrder(events, chapters)

  // Per character, the markers they occupy over time (nulls skipped), so we can
  // ask "were A and B ever at the same place within this order window?".
  const charLocs = new Map<string, Array<{ order: number; markerId: string }>>()
  for (const s of snapshots) {
    if (!s.currentLocationMarkerId) continue
    const arr = charLocs.get(s.characterId) ?? []
    arr.push({ order: eventOrder(s.eventId), markerId: s.currentLocationMarkerId })
    charLocs.set(s.characterId, arr)
  }

  function markersInWindow(charId: string, lo: number, hi: number): Set<string> {
    const out = new Set<string>()
    for (const l of charLocs.get(charId) ?? []) {
      if (l.order >= lo && l.order <= hi) out.add(l.markerId)
    }
    return out
  }

  // Collect every possession entry, grouped by item.
  const entriesByItem = new Map<string, Entry[]>()
  const push = (itemId: string, e: Entry) => {
    const key = `${itemId}\u0000${story?.eraOf(e.eventId) ?? ''}`
    const arr = entriesByItem.get(key) ?? []
    arr.push(e)
    entriesByItem.set(key, arr)
  }
  for (const s of snapshots) {
    for (const itemId of s.inventoryItemIds) {
      push(itemId, {
        order: eventOrder(s.eventId), eventId: s.eventId,
        holderKey: `c:${s.characterId}`, kind: 'char',
        charId: s.characterId, markerId: s.currentLocationMarkerId,
      })
    }
  }
  for (const p of placements) {
    push(p.itemId, {
      order: eventOrder(p.eventId), eventId: p.eventId,
      holderKey: `l:${p.locationMarkerId}`, kind: 'loc',
      charId: null, markerId: p.locationMarkerId,
    })
  }

  const out: ItemHandoffIssue[] = []

  for (const [key, entries] of entriesByItem) {
    const itemId = key.slice(0, key.indexOf('\u0000'))
    // Order by narrative position; break ties by holderKey for determinism.
    entries.sort((a, b) => a.order - b.order || a.holderKey.localeCompare(b.holderKey))

    // Collapse consecutive same-holder entries into runs.
    const runs: Run[] = []
    for (const e of entries) {
      const last = runs[runs.length - 1]
      if (last && sameHolder(last, e)) {
        last.lastOrder = e.order
        last.lastMarkerId = e.markerId
      } else {
        runs.push({
          kind: e.kind, charId: e.charId,
          firstOrder: e.order, firstEventId: e.eventId, firstMarkerId: e.markerId,
          lastOrder: e.order, lastMarkerId: e.markerId,
        })
      }
    }

    for (let i = 1; i < runs.length; i++) {
      const prev = runs[i - 1]
      const curr = runs[i]
      if (prev.kind !== 'char' || curr.kind !== 'char') continue
      if (!prev.charId || !curr.charId || prev.charId === curr.charId) continue

      const fromMarkerId = prev.lastMarkerId
      const toMarkerId = curr.firstMarkerId
      if (!fromMarkerId || !toMarkerId || fromMarkerId === toMarkerId) continue

      // Plausible if the two characters share any location across the hand-off
      // window (they could have met and passed it over).
      const lo = prev.lastOrder
      const hi = curr.firstOrder
      const markersA = markersInWindow(prev.charId, lo, hi)
      const markersB = markersInWindow(curr.charId, lo, hi)
      let coLocated = false
      for (const m of markersA) {
        if (markersB.has(m)) { coLocated = true; break }
      }
      if (coLocated) continue

      out.push({
        itemId,
        fromCharacterId: prev.charId,
        toCharacterId: curr.charId,
        fromMarkerId,
        toMarkerId,
        handoffEventId: curr.firstEventId,
      })
    }
  }

  return out
}

/** Two entries belong to the same run when they share the exact holder key. */
function sameHolder(run: Run, e: Entry): boolean {
  const runKey = run.kind === 'char' ? `c:${run.charId}` : `l:${run.lastMarkerId}`
  return runKey === e.holderKey
}
