import { test } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { readZip } from '../src/lib/zip'
import { parseManuscript, type ParsedManuscript } from '../src/lib/manuscriptImport'

/*
  Import Manuscript from Word, measured (issue #697, step 1). For each file of
  the corpus (`scripts/docx-import-corpus.py`, and the files the probe adds),
  what two readings of it make, against what it holds (`<name>.truth.json`):

  - (A) text only: each paragraph's words, one paragraph to a block, given to
    the Markdown rules as they are, the way a writer pasting from Word would;
  - (B) a first reading that knows Word: a paragraph styled as a heading, or
    at an outline level, by its style's name rather than its id, is a heading
    line; several empty paragraphs together are a scene break; a page break
    before a line that reads as a chapter is a boundary.

  A tool, not a test: run by hand.

    DOCX_DIR=<dir> npx vitest run --config vitest.probe.config.ts scripts/docx-import-probe.ts
*/

const DIR = process.env.DOCX_DIR!
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

interface Para { text: string; heading: number | null; pageBreak: boolean; empty: boolean; italics: string[] }

async function paragraphs(file: string): Promise<{ paras: Para[]; tracked: { ins: number; del: number }; comments: number }> {
  const zip = await readZip(new Uint8Array(readFileSync(file)))
  const dec = new TextDecoder()
  const parse = (name: string) => {
    const bytes = zip.get(name)
    return bytes ? new DOMParser().parseFromString(dec.decode(bytes), 'application/xml') : null
  }
  const doc = parse('word/document.xml')!
  const stylesDoc = parse('word/styles.xml')
  // Each paragraph style's heading level, by its name ("heading 1", "Title") or its outline level, never its id.
  const level = new Map<string, number>()
  const italicStyles = new Set<string>()
  for (const s of stylesDoc ? [...stylesDoc.getElementsByTagNameNS(W, 'style')] : []) {
    const id = s.getAttributeNS(W, 'styleId') ?? ''
    const name = (s.getElementsByTagNameNS(W, 'name')[0]?.getAttributeNS(W, 'val') ?? '').toLowerCase()
    const outline = s.getElementsByTagNameNS(W, 'outlineLvl')[0]?.getAttributeNS(W, 'val')
    const m = /^heading (\d)$/.exec(name)
    if (name === 'title') level.set(id, 0)
    else if (m) level.set(id, Number(m[1]))
    else if (outline !== undefined && outline !== null) level.set(id, Number(outline) + 1)
    if (s.getAttributeNS(W, 'type') === 'character' && s.getElementsByTagNameNS(W, 'i').length) italicStyles.add(id)
  }
  const paras: Para[] = []
  for (const p of [...doc.getElementsByTagNameNS(W, 'p')]) {
    const style = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') ?? ''
    const own = p.getElementsByTagNameNS(W, 'pPr')[0]?.getElementsByTagNameNS(W, 'outlineLvl')[0]?.getAttributeNS(W, 'val')
    const heading = own != null ? Number(own) + 1 : level.get(style) ?? null
    const pageBreak = p.getElementsByTagNameNS(W, 'pageBreakBefore').length > 0 ||
      [...p.getElementsByTagNameNS(W, 'br')].some((b) => b.getAttributeNS(W, 'type') === 'page')
    let text = ''
    const italics: string[] = []
    for (const r of [...p.getElementsByTagNameNS(W, 'r')]) {
      if (r.parentElement?.localName === 'del') continue
      const rs = r.getElementsByTagNameNS(W, 'rStyle')[0]?.getAttributeNS(W, 'val')
      const it = r.getElementsByTagNameNS(W, 'i').length > 0 || (rs != null && italicStyles.has(rs))
      let t = ''
      for (const c of [...r.childNodes] as Element[]) {
        if (c.localName === 't') t += c.textContent ?? ''
        else if (c.localName === 'br' && c.getAttributeNS(W, 'type') !== 'page') t += '\n'
        else if (c.localName === 'tab') t += '\t'
      }
      if (it && t.trim()) italics.push(t)
      text += t
    }
    paras.push({ text: text.replace(/^\t+/, ''), heading, pageBreak, empty: !text.trim(), italics })
  }
  return {
    paras,
    tracked: { ins: doc.getElementsByTagNameNS(W, 'ins').length, del: doc.getElementsByTagNameNS(W, 'del').length },
    comments: parse('word/comments.xml')?.getElementsByTagNameNS(W, 'comment').length ?? 0,
  }
}

const CHAPTERISH = /^(chapter|part|book|prologue|epilogue|letter|cap[ií]tulo)\b/i

function readingA(paras: Para[]): string {
  return paras.filter((p) => !p.empty).map((p) => p.text).join('\n\n')
}

function readingB(paras: Para[]): string {
  const out: string[] = []
  let blanks = 0
  paras.forEach((p) => {
    if (p.empty) { blanks++; return }
    if (blanks >= 2 && out.length) out.push('* * *')
    blanks = 0
    if (p.heading !== null) out.push(`${'#'.repeat(Math.max(1, p.heading))} ${p.text}`)
    else if (p.pageBreak && CHAPTERISH.test(p.text.trim())) out.push(`# ${p.text}`)
    else out.push(p.text)
  })
  return out.join('\n\n')
}

interface Truth { book: string; shape: string; chapters: Array<{ title: string; scenes: Array<{ words: number; italics: string[] }> }> }

function score(m: ParsedManuscript, truth: Truth) {
  const want = truth.chapters
  const got = m.chapters.filter((c) => c.scenes.some((s) => s.text.trim()))
  const titles = want.filter((c, k) => (got[k]?.title ?? '').toLowerCase() === c.title.toLowerCase()).length
  const scenes = want.filter((c, k) => got[k]?.scenes.length === c.scenes.length).length
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length
  const wantWords = want.reduce((n, c) => n + c.scenes.reduce((k, s) => k + s.words, 0), 0)
  const gotWords = got.reduce((n, c) => n + c.scenes.reduce((k, s) => k + words(s.text.replace(/[_*]/g, '')), 0), 0)
  return `chapters ${got.length}/${want.length}, titles ${titles}/${want.length}, scene counts right ${scenes}/${want.length}, words ${gotWords}/${wantWords}, book title ${JSON.stringify(m.title)}`
}

test('docx import, measured', async () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.docx')).sort()
  for (const f of files) {
    const truthFile = join(DIR, f.replace(/\.docx$/, '.truth.json'))
    if (!existsSync(truthFile)) continue
    const truth = JSON.parse(readFileSync(truthFile, 'utf8')) as Truth
    const { paras, tracked, comments } = await paragraphs(join(DIR, f))
    const italicsWant = truth.chapters.reduce((n, c) => n + c.scenes.reduce((k, s) => k + s.italics.length, 0), 0)
    const italicsGot = paras.reduce((n, p) => n + p.italics.length, 0)
    console.log(`\n== ${f}: ${truth.shape}`)
    console.log(`  paragraphs ${paras.length} (${paras.filter((p) => p.empty).length} empty, ${paras.filter((p) => p.heading !== null).length} heading-styled, ${paras.filter((p) => p.pageBreak).length} after a page break); italic runs read ${italicsGot}, written ${italicsWant}; tracked ins ${tracked.ins} del ${tracked.del}; comments ${comments}`)
    console.log(`  (A) text only:   ${score(parseManuscript(readingA(paras)), truth)}`)
    console.log(`  (B) knowing Word: ${score(parseManuscript(readingB(paras)), truth)}`)
    const b = parseManuscript(readingB(paras))
    const wrong = truth.chapters.map((c, k) => [c.title, b.chapters[k]?.title ?? '(none)'] as const).filter(([w, g]) => w.toLowerCase() !== g.toLowerCase())
    if (wrong.length) console.log(`  (B) titles not as written: ${wrong.slice(0, 3).map(([w, g]) => `${JSON.stringify(w)} → ${JSON.stringify(g)}`).join('; ')}`)
  }
})

test('detail', async () => {
  for (const f of (process.env.DETAIL ?? '').split(',').filter(Boolean)) {
    const { paras } = await paragraphs(join(DIR, f))
    const b = parseManuscript(readingB(paras))
    console.log(`\n## ${f}: title ${JSON.stringify(b.title)}`)
    b.chapters.forEach((c, k) => console.log(`  ch${k + 1} ${JSON.stringify(c.title)} scenes ${c.scenes.length} first ${JSON.stringify(c.scenes[0]?.text.slice(0, 70))} titles ${JSON.stringify(c.scenes.map((s) => s.title ?? null).slice(0, 4))}`))
  }
})
