import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { BookProse } from '../src/lib/proseChecks'

/**
 * The Library's books with prose, for the prose checks' probes (R6). Not
 * Portuguese ones: the baseline is of English, and so are the checks.
 */
export const LIBRARY = join(process.env.KATHALA_LIBRARY ?? '../Kathala-Library', 'library')
const NOT_ENGLISH = new Set(['os-lusiadas-pt', 'os-maias'])

export function libraryBooks(): Array<{ name: string; book: BookProse }> {
  if (!existsSync(LIBRARY)) throw new Error(`No library at ${LIBRARY}: clone SirFoxworthTheThird/Kathala-Library beside this repository, or set KATHALA_LIBRARY.`)
  const out: Array<{ name: string; book: BookProse }> = []
  for (const file of readdirSync(LIBRARY).filter((f) => f.endsWith('.pwk')).sort()) {
    const name = file.replace('.pwk', '')
    if (NOT_ENGLISH.has(name)) continue
    const w = JSON.parse(readFileSync(join(LIBRARY, file), 'utf8')) as {
      chapters?: Array<{ id: string; number: number }>
      events?: Array<{ id: string; chapterId: string; sortOrder: number }>
      sceneTexts?: Array<{ eventId: string; text: string }>
    }
    const text = new Map((w.sceneTexts ?? []).map((t) => [t.eventId, t.text]))
    if (text.size === 0) continue
    const chapters = [...(w.chapters ?? [])].sort((a, b) => a.number - b.number).map((c) => ({
      id: c.id,
      number: c.number,
      scenes: (w.events ?? []).filter((e) => e.chapterId === c.id && text.get(e.id)?.trim())
        .sort((a, b) => a.sortOrder - b.sortOrder).map((e) => ({ eventId: e.id, text: text.get(e.id)! })),
    })).filter((c) => c.scenes.length > 0)
    out.push({ name, book: { chapters } })
  }
  return out
}
