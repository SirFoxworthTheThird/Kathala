import { db } from '@/db/database'
import { setSceneText } from '@/db/hooks/useManuscript'
import { updateEvent, updateChapter } from '@/db/hooks/useTimeline'

/*
  What was typed and not yet written when the browser page went away.

  The writing surfaces save on a short timer, and an IndexedDB write is
  asynchronous: one started as the page unloads — a reload, a closed tab — is
  torn down with it. A writer run measured it on the Page: typing lost on a
  reload at 150, 400 and 900ms, kept from 1.2s. `localStorage` is written
  synchronously, so it is what an unloading page can still rely on.

  So the page stashes what it owes here as it goes, and the next start of the
  app writes it to the store — unless the record has been written since the
  stash was made, by this page's own save landing after all or by another tab,
  which is newer than anything kept here.
*/

const KEY = 'kathala-unsaved'

export interface Unsaved {
  worldId: string
  /** When it was stashed: a record written after this is newer, and kept. */
  at: number
  /** Scene prose, by event id. */
  scenes: Record<string, string>
  /** Scene titles, by event id. */
  sceneTitles: Record<string, string>
  /** Chapter titles, by chapter id. */
  chapterTitles: Record<string, string>
}

/** Keep what is owed where an unloading page can still write it. Never throws. */
export function stashUnsaved(entry: Omit<Unsaved, 'at'>, at = Date.now()) {
  const empty = !Object.keys(entry.scenes).length && !Object.keys(entry.sceneTitles).length && !Object.keys(entry.chapterTitles).length
  try {
    if (empty) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify({ ...entry, at }))
  } catch {
    // Storage blocked or full: nothing more can be done from a page that is going.
  }
}

export function readUnsaved(): Unsaved | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Unsaved) : null
  } catch {
    return null
  }
}

/**
 * Write what a page left owing, and forget it. Returns how many records it
 * wrote. Each is skipped if the store already says it, or has been written
 * since the stash was made.
 */
export async function restoreUnsaved(): Promise<number> {
  const owed = readUnsaved()
  if (!owed) return 0
  let written = 0
  try {
    for (const [eventId, text] of Object.entries(owed.scenes)) {
      const event = await db.events.get(eventId)
      if (!event) continue
      const stored = await db.sceneTexts.where('eventId').equals(eventId).first()
      if ((stored?.text ?? '') === text || (stored?.updatedAt ?? 0) > owed.at) continue
      await setSceneText(owed.worldId, eventId, text)
      written++
    }
    for (const [eventId, title] of Object.entries(owed.sceneTitles)) {
      const event = await db.events.get(eventId)
      if (!event || event.title === title || (event.updatedAt ?? 0) > owed.at) continue
      await updateEvent(eventId, { title })
      written++
    }
    for (const [chapterId, title] of Object.entries(owed.chapterTitles)) {
      const chapter = await db.chapters.get(chapterId)
      if (!chapter || chapter.title === title || (chapter.updatedAt ?? 0) > owed.at) continue
      await updateChapter(chapterId, { title })
      written++
    }
  } finally {
    // Once tried, gone: a stash that cannot be applied must not be retried over newer work forever.
    try { localStorage.removeItem(KEY) } catch { /* nothing to do */ }
  }
  return written
}
