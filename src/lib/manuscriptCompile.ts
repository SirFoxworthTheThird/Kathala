import type { Chapter, WorldEvent, SceneText } from '@/types'

/**
 * Manuscript assembly: stitch per-scene prose (one SceneText per event) into a
 * continuous document in reading order — chapters by number, scenes by the
 * event's sortOrder within each chapter — and compile it to Markdown, HTML, or
 * plain text for export.
 *
 * Pure and side-effect free so it can be unit-tested and reused by both the
 * on-screen reader and the export/download path.
 */

export interface ManuscriptScene {
  eventId: string
  title: string
  text: string
  wordCount: number
  /** True when the scene has any prose written. */
  written: boolean
}

export interface ManuscriptChapter {
  id: string
  number: number
  title: string
  synopsis: string
  wordCount: number
  /** The chapter's word-count target, or null if unset. */
  wordGoal: number | null
  scenes: ManuscriptScene[]
  /** How many of this chapter's scenes have prose. */
  writtenScenes: number
}

export interface BuiltManuscript {
  chapters: ManuscriptChapter[]
  totalWords: number
  totalScenes: number
  writtenScenes: number
}

/** Assemble the ordered manuscript from chapters, their events, and scene prose. */
export function buildManuscript({
  chapters,
  events,
  sceneTextByEvent,
}: {
  chapters: Chapter[]
  events: WorldEvent[]
  sceneTextByEvent: Map<string, Pick<SceneText, 'text' | 'wordCount'>>
}): BuiltManuscript {
  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number)

  const eventsByChapter = new Map<string, WorldEvent[]>()
  for (const e of events) {
    const arr = eventsByChapter.get(e.chapterId)
    if (arr) arr.push(e)
    else eventsByChapter.set(e.chapterId, [e])
  }

  let totalWords = 0
  let totalScenes = 0
  let writtenScenes = 0

  const outChapters: ManuscriptChapter[] = sortedChapters.map((ch) => {
    const evs = [...(eventsByChapter.get(ch.id) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    let chapterWords = 0
    let chapterWritten = 0

    const scenes: ManuscriptScene[] = evs.map((e) => {
      const st = sceneTextByEvent.get(e.id)
      const text = st?.text ?? ''
      const wc = st?.wordCount ?? 0
      const written = wc > 0
      chapterWords += wc
      totalScenes += 1
      if (written) {
        chapterWritten += 1
        writtenScenes += 1
      }
      return { eventId: e.id, title: e.title || 'Untitled scene', text, wordCount: wc, written }
    })

    totalWords += chapterWords
    return {
      id: ch.id,
      number: ch.number,
      title: ch.title,
      synopsis: ch.synopsis,
      wordCount: chapterWords,
      wordGoal: ch.wordGoal,
      scenes,
      writtenScenes: chapterWritten,
    }
  })

  return { chapters: outChapters, totalWords, totalScenes, writtenScenes }
}

export type CompileFormat = 'markdown' | 'html' | 'text'

export interface CompileOptions {
  /** Include "Ch. N — Title" chapter headings. Default true. */
  chapterTitles?: boolean
  /** Skip scenes that have no prose yet. Default true. */
  onlyWritten?: boolean
  /** Marker printed between scenes within a chapter. Default "* * *". */
  sceneSeparator?: string
  /** Document title (HTML <title> / leading heading). */
  title?: string
}

/** Split prose into paragraphs on blank lines, trimming each. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Compile a built manuscript to a shareable string in the given format. */
export function compileManuscript(
  m: BuiltManuscript,
  format: CompileFormat,
  opts: CompileOptions = {}
): string {
  const chapterTitles = opts.chapterTitles ?? true
  const onlyWritten = opts.onlyWritten ?? true
  const sep = opts.sceneSeparator ?? '* * *'
  const title = opts.title?.trim() || 'Manuscript'

  const chapterBlocks = m.chapters.map((ch) => {
    const scenes = onlyWritten ? ch.scenes.filter((s) => s.written) : ch.scenes
    return { ch, scenes }
  })

  if (format === 'html') {
    const body = chapterBlocks
      .filter((b) => b.scenes.length > 0)
      .map(({ ch, scenes }) => {
        const head = chapterTitles ? `<h2>Ch. ${ch.number} — ${escapeHtml(ch.title || 'Untitled')}</h2>\n` : ''
        const sceneHtml = scenes
          .map((s) =>
            (s.written ? paragraphs(s.text) : ['<em>[No prose yet]</em>'])
              .map((p) => (s.written ? `<p>${escapeHtml(p)}</p>` : `<p>${p}</p>`))
              .join('\n')
          )
          .join('\n<hr class="scene-break" />\n')
        return head + sceneHtml
      })
      .join('\n')
    return [
      '<!doctype html>',
      '<html><head><meta charset="utf-8" />',
      `<title>${escapeHtml(title)}</title>`,
      '<style>body{max-width:40rem;margin:2rem auto;padding:0 1rem;font:1rem/1.7 Georgia,serif}h2{margin:2.5rem 0 1rem;font-size:1.4rem}hr.scene-break{border:0;text-align:center;margin:1.5rem 0}hr.scene-break::before{content:"* * *";color:#888}p{margin:0 0 1rem;text-indent:1.5rem}</style>',
      '</head><body>',
      `<h1>${escapeHtml(title)}</h1>`,
      body,
      '</body></html>',
    ].join('\n')
  }

  // markdown / text
  const heading = (ch: ManuscriptChapter) =>
    format === 'markdown' ? `# Ch. ${ch.number} — ${ch.title || 'Untitled'}` : `Ch. ${ch.number} — ${ch.title || 'Untitled'}`

  return chapterBlocks
    .filter((b) => b.scenes.length > 0)
    .map(({ ch, scenes }) => {
      const parts: string[] = []
      if (chapterTitles) parts.push(heading(ch))
      const sceneText = scenes
        .map((s) => (s.written ? s.text.trim() : '[No prose yet]'))
        .join(`\n\n${sep}\n\n`)
      parts.push(sceneText)
      return parts.join('\n\n')
    })
    .join('\n\n\n')
}
