import type { ResearchItem, ResearchKind, ResearchLink, ResearchTarget } from '@/types'
import { searchMatches } from './searchMatch'

/*
  Research and reference material (issue #700, docs/records/research-plan.md):
  what a file may be, what an item is attached to, and how the Research list
  is filtered and searched. Pure; the table is written by
  `src/db/hooks/useResearch.ts`.
*/

/** The most a research file may be (D-2). A backup carries its files, and a browser reads a backup back as one string. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024

/** Above this many bytes of research files, a backup leaves them out unless asked (D-3): it may not open elsewhere. */
export const EXPORT_FILES_SOFT_LIMIT = 200 * 1024 * 1024

export const isImage = (mime: string | undefined) => !!mime && mime.startsWith('image/')
export const isPdf = (mime: string | undefined) => mime === 'application/pdf'

/** A size as a writer reads it: *1.4 MB*, *820 KB*. */
export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} bytes`
}

/** Why a file cannot be research, or null: only images and PDFs, of at most 20 MB (D-2). */
export function fileProblem(file: { name: string; type: string; size: number }): string | null {
  if (!isImage(file.type) && !isPdf(file.type)) {
    return `“${file.name}” is not an image or a PDF. Research files can be pictures (JPEG, PNG, GIF, WebP…) or PDFs.`
  }
  if (file.size > MAX_FILE_BYTES) {
    return `“${file.name}” is ${formatBytes(file.size)}. A research file can be at most ${formatBytes(MAX_FILE_BYTES)}, so a backup of the book still opens.`
  }
  return null
}

/** Why a link cannot be research, or null: an address the browser can open in a tab. */
export function linkProblem(url: string): string | null {
  const u = url.trim()
  if (!u) return 'A link needs an address.'
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'A link’s address starts with http:// or https://.'
  } catch {
    return 'That is not a web address. A link’s address starts with http:// or https://.'
  }
  return null
}

const sameLink = (a: ResearchLink, b: ResearchLink) => a.kind === b.kind && a.id === b.id

/** An attachment list with `link` in it, once. */
export function attached(list: readonly ResearchLink[], link: ResearchLink): ResearchLink[] {
  return list.some((l) => sameLink(l, link)) ? [...list] : [...list, { kind: link.kind, id: link.id }]
}

/** An attachment list without `link`. */
export function detached(list: readonly ResearchLink[], link: ResearchLink): ResearchLink[] {
  return list.filter((l) => !sameLink(l, link))
}

/** Whether an item is attached to `link`. */
export const isAttached = (item: Pick<ResearchItem, 'attachedTo'>, link: ResearchLink) => item.attachedTo.some((l) => sameLink(l, link))

/** Attached to nothing, and not to the world: what a deleted scene or entity can leave behind (D-5). */
export const isLoose = (item: Pick<ResearchItem, 'attachedTo' | 'toWorld'>) => !item.toWorld && item.attachedTo.length === 0

/** What the Research list is filtered by: a kind, and what an item is attached to. */
export interface ResearchFilter {
  kind?: ResearchKind | 'image' | 'pdf'
  /** A record, the world, or nothing at all. */
  on?: ResearchLink | 'world' | 'nothing' | { kind: ResearchTarget }
  query?: string
  wholeWord?: boolean
}

/** The words an item is found by: its title, note, clipping, source and address. */
export function researchWords(item: Pick<ResearchItem, 'title' | 'note' | 'text' | 'source' | 'url'>): string[] {
  return [item.title, item.note, item.text ?? '', item.source ?? '', item.url ?? ''].filter(Boolean)
}

export function researchMatches(item: ResearchItem, f: ResearchFilter): boolean {
  if (f.kind === 'image' && !(item.kind === 'file' && isImage(item.mimeType))) return false
  if (f.kind === 'pdf' && !(item.kind === 'file' && isPdf(item.mimeType))) return false
  if (f.kind && f.kind !== 'image' && f.kind !== 'pdf' && item.kind !== f.kind) return false
  if (f.on === 'world' && !item.toWorld) return false
  if (f.on === 'nothing' && !isLoose(item)) return false
  if (f.on && typeof f.on === 'object') {
    if ('id' in f.on) {
      if (!isAttached(item, f.on)) return false
    } else {
      const kind = f.on.kind
      if (!item.attachedTo.some((l) => l.kind === kind)) return false
    }
  }
  const q = f.query?.trim()
  if (q && !researchWords(item).some((w) => searchMatches(w, q, !!f.wholeWord))) return false
  return true
}

/** Items in their order: the Research list's, and a mood board's (D-1). */
export const byOrder = (a: ResearchItem, b: ResearchItem) => a.order - b.order || a.createdAt - b.createdAt

/** A list in a new order, `id` moved to `to`: what dragging on the mood board does. */
export function moved<T extends { id: string }>(list: readonly T[], id: string, to: number): T[] {
  const from = list.findIndex((x) => x.id === id)
  if (from < 0) return [...list]
  const out = [...list]
  const [it] = out.splice(from, 1)
  out.splice(Math.max(0, Math.min(to, out.length)), 0, it)
  return out
}

/** The bytes a backup's research files come to. */
export function filesTotal(items: ReadonlyArray<Pick<ResearchItem, 'kind' | 'size'>>): number {
  return items.reduce((n, i) => n + (i.kind === 'file' ? i.size ?? 0 : 0), 0)
}
