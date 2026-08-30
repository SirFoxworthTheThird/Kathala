import type { Page } from '@playwright/test'

/**
 * Ground truth for the reveal gate, read from the store rather than assumed:
 * which characters, items and places the reader has not met at the cursor, and
 * which text names things regardless (the book's own title and its chapter
 * titles, which are printed on the reader's own contents page).
 *
 * Shared by the specs that check the promise from different angles — one walks
 * every route, another drives the search palette.
 */
export interface Unmet {
  characters: string[]
  items: string[]
  locations: string[]
  /** Subplots and motifs the reader has not reached — named for where they go. */
  threads: string[]
}

/** Names the reader has not met, read from the store rather than assumed. */
export async function unmetNames(page: Page): Promise<Unmet> {
  return page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('PlotWeaveDB')
    req.onsuccess = () => {
      const db = req.result
      const read = (s) => new Promise((r) => {
        const q = db.transaction(s, 'readonly').objectStore(s).getAll()
        q.onsuccess = () => r(q.result)
      })
      Promise.all([
        read('events'), read('chapters'), read('characters'), read('items'),
        read('locationMarkers'), read('characterSnapshots'), read('itemPlacements'),
        read('itemSnapshots'), read('locationSnapshots'), read('plotThreads'), read('motifs'),
      ]).then(([events, chapters, characters, items, markers, cs, ip, isn, ls, threads, motifs]) => {
        const chapNum = new Map(chapters.map(c => [c.id, c.number]))
        const key = new Map(events.map(e => [e.id, (chapNum.get(e.chapterId) ?? 0) + e.sortOrder / 1e6]))
        const cursorId = JSON.parse(localStorage.getItem('plotweave-ui') || '{}')?.state?.activeEventId
        const cursor = key.get(cursorId)
        const first = new Map()
        const add = (id, evId) => {
          const k = key.get(evId); if (k === undefined || !id) return
          const cur = first.get(id); if (cur === undefined || k < cur) first.set(id, k)
        }
        for (const e of events) {
          for (const id of e.involvedCharacterIds || []) add(id, e.id)
          add(e.povCharacterId, e.id)
          for (const id of e.involvedItemIds || []) add(id, e.id)
          add(e.locationMarkerId, e.id)
        }
        for (const s of cs) {
          add(s.characterId, s.eventId); add(s.currentLocationMarkerId, s.eventId)
          for (const i of s.inventoryItemIds || []) add(i, s.eventId)
        }
        for (const p of ip) add(p.itemId, p.eventId)
        for (const s of isn) add(s.itemId, s.eventId)
        for (const s of ls) add(s.locationMarkerId, s.eventId)
        // An entity the reader has not reached — including one the story never
        // places at all. Counting only \`f > cursor\` would define "unmet" the way
        // the implementation does rather than the way a reader does, and would
        // make this helper structurally unable to report the very class of leak
        // it exists to catch.
        const hidden = (rec) => { const f = first.get(rec.id); return f === undefined || f > cursor }
        for (const e of events) for (const id of (e.threadIds || [])) add(id, e.id)
        for (const e of events) for (const id of (e.motifIds || [])) add(id, e.id)
        resolve({
          characters: characters.filter(hidden).map(c => c.name),
          items: items.filter(hidden).map(i => i.name),
          locations: markers.filter(hidden).map(m => m.name),
          threads: [...threads, ...motifs].filter(hidden).map(t => t.name),
        })
      })
    }
  }))()`)
}

/**
 * Text that names things regardless of reading mode, and legitimately so: the
 * book's own title and description, and its chapter titles, which are printed
 * on the contents page of the physical copy. PlotWeave showing them gives away
 * nothing the reader's own book does not.
 */
export async function benignText(page: Page): Promise<string> {
  const parts = await page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('PlotWeaveDB')
    req.onsuccess = () => {
      const db = req.result
      const read = (s) => new Promise((r) => {
        const q = db.transaction(s, 'readonly').objectStore(s).getAll(); q.onsuccess = () => r(q.result)
      })
      Promise.all([read('chapters'), read('worlds')]).then(([chapters, worlds]) =>
        resolve([
          ...chapters.map(c => c.title || ''),
          ...worlds.flatMap(w => [w.name || '', w.description || '']),
        ]))
    }
  }))()`) as string[]
  return parts.join(' \n ').toLowerCase()
}
