import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { changeCount, changeSaid, commentedIn, markDeclined, markedParagraphs, markedPlan, tallyNote, type MarkedParagraph } from '@/lib/markedDocx'
import { compileDocx } from '@/lib/manuscriptExport'
import { readEditedDocx } from '@/lib/docxRead'
import { docScenes, withChangesMade } from '@/lib/docxEdits'
import { rendered } from '@/lib/docxImport'
import { readStoredZip } from '@/lib/zip'
import type { DraftBook } from '@/lib/bookDraft'
import type { EditorChange } from '@/types'

/*
  What the editor is told of their changes (round-trip-plan-4.md, T18;
  loop-2026-11-14.md, finding 7 and the plan's first expectation). The third
  loop's editor wrote a classifier to learn which of their edits stood: 55
  stand, 7 not taken, 5 in passages rewritten since. The dialog said 53, 4 and
  9, and "6 put back" beside them, and the writer listed seven.
*/

const F = path.join(__dirname, 'fixtures/docx/run-2026-11-14-loop3')
type Draft = { id: string; book: DraftBook; editors?: string[]; editorChanges?: EditorChange[] }
const draft = (n: string) => JSON.parse(readFileSync(path.join(F, `draft-${n}.json`), 'utf8')) as Draft
const planOf = (backN: string, wentN: string, nowN: string) => {
  const back = draft(backN), went = draft(wentN), now = draft(nowN)
  const scenes = now.book.chapters.flatMap((c) => c.scenes.map((s) => ({ eventId: s.id, text: s.text, chapterId: c.id })))
  return { back, now, plan: markedPlan({ sentBack: { id: back.id, editors: back.editors, editorChanges: back.editorChanges }, base: back.book, went: went.book, scenes, chapters: now.book.chapters, notes: [], author: 'Tamsin Hale', now: 0 }) }
}

describe('the third loop, remade change by change (T18.0)', () => {
  it('round 2: 53 stand, 5 turned back, 8 rewritten since; the file’s changes signed as declined are the 5', () => {
    const { plan } = planOf('back-1', 'sent-1', 'marked-2')
    expect(plan.tally).toEqual({ stand: 53, turnedBack: 5, rewritten: 8 })
    // Borne out by the file: each turned back is one change signed (edit declined), the join too (T18.2).
    expect(plan.declined).toBe(plan.tally!.turnedBack)
    /*
      Against the editor's own classifier, 55 stand, 7 not taken, 5 rewritten:
      - the 5 turned back are the editor's 5 marked declined;
      - the editor's other 2 not taken, "a thousand times" and "Orrin isn't
        coming", the writer rewrote over and signed as her own: rewritten here;
      - the editor's 5 rewritten are here, and one more: "She did not know why"
        cut, and the sentence after it rewritten in the same place;
      - the editor counts 67 acts, the file 66 changes: two of theirs are one
        run in it.
    */
    expect(plan.notTaken.map((n) => `${n.became}: ${n.scene}: ${n.said}`)).toEqual([
      'turnedBack: Chapter 1, “The Tally Desk”: cut “forty-two hundredweight of”',
      'turnedBack: Chapter 1, “The Tally Desk”: “looking at” made “over”',
      'turnedBack: Chapter 1, “The North Quay”: cut “one by one”',
      'rewritten: Chapter 3, “Coil Lane”: cut “She did not know why.”',
      'turnedBack: Chapter 4, “The Causeway”: a new paragraph after “…her out on the rope without a word.”',
      'rewritten: Chapter 4, “Below the Weed Line”: “had seen a thousand times” made “knew better than her own name”',
      'rewritten: Chapter 4, “Below the Weed Line”: cut “by hand”',
      'turnedBack: Chapter 5, “The Councillor\'s House”: two paragraphs joined after “…think about it. Her feet took her.”',
      'rewritten: Chapter 5, “The Councillor\'s House”: “lap and” made “lap. Before she let herself think, she took the marbled book down and…”',
      'rewritten: Chapter 6, “The River Door”: “is here” made “isn\'t coming”',
      'rewritten: Chapter 6, “The Tally Desk”: “every night since the night of the north quay” made “since the night Captain Orrin came to Coil Lane”',
      'rewritten: Chapter 6, “The Tally Desk”: “afterward” made “afterwards”',
      'rewritten: Chapter 6, “The Tally Desk”: “every night” made “or as near it as she could”',
    ])
  })

  it('round 3: 24 stand and 3 turned back; two spaces put right where a move left sentences run together stand', () => {
    const { plan } = planOf('back-2', 'marked-2', 'marked-3')
    // 22, 3 and 2 before: "coat.I" made "coat. I" is nowhere in the text as it went, only after the move.
    expect(plan.tally).toEqual({ stand: 24, turnedBack: 3, rewritten: 0 })
    expect(plan.declined).toBe(3)
  })

  it('the copy for the cover note: the figures, those not taken with their scenes and words, and that every other stands', () => {
    const { back, plan } = planOf('back-2', 'marked-2', 'marked-3')
    expect(tallyNote(back.editors ?? [], plan.tally!, plan.notTaken, 'Tamsin Hale')).toBe([
      'Of Maren Hollis’s 27 changes: 24 stand, 3 turned back.',
      '',
      'Turned back, each marked in the file and signed Tamsin Hale (edit declined):',
      '- Chapter 3, “Coil Lane”: cut “then”',
      '- Chapter 4, “Below the Weed Line”: “the gate” made “it”',
      '- Chapter 5, “Cellar Three”: cut “He did not look up.”',
      '',
      'Every other change of yours stands as you made it.',
    ].join('\n'))
  })
})

describe('tallyNote and changeSaid', () => {
  const c = (before: string, after: string, prefix = 'Words before it, ', suffix = ' and after.'): EditorChange => ({ eventId: 'e', before, after, prefix, suffix })

  it('every change taken: the figures alone', () => {
    expect(tallyNote(['Ana Editor'], { stand: 3, turnedBack: 0, rewritten: 0 }, [], 'W')).toBe('Of Ana Editor’s 3 changes: 3 stand.')
  })

  it('rewritten since alone: listed, with no heading for turned back', () => {
    expect(tallyNote([], { stand: 1, turnedBack: 0, rewritten: 1 }, [{ scene: 'Chapter 2, “Gate”', became: 'rewritten', said: 'cut “now”' }], 'W')).toBe([
      'Of the editor’s 2 changes: 1 stands, 1 rewritten since.',
      '',
      'Rewritten since, where the words are now my own:',
      '- Chapter 2, “Gate”: cut “now”',
      '',
      'Every other change of yours stands as you made it.',
    ].join('\n'))
  })

  it('a change said in its own words, narrowed to the words that differ, at whole words', () => {
    // Bringing a file in keeps a change with the words about it.
    expect(changeSaid(c('her now.', 'her.'))).toBe('cut “now”')
    expect(changeSaid(c('the road', 'the coast road'))).toBe('put in “coast” after “…before it, the”')
    expect(changeSaid(c('looking at', 'over'))).toBe('“looking at” made “over”')
    // Not inside a word, and not starting on a stop.
    expect(changeSaid(c('waited', 'wanted'))).toBe('“waited” made “wanted”')
    expect(changeSaid(c('lap and ', 'lap. Then '))).toBe('“lap and” made “lap. Then”')
    expect(changeSaid(c('word. ', 'word.\n\n', 'without a '))).toBe('a new paragraph after “…a word.”')
    expect(changeSaid(c('her.\n\n', 'her. ', 'Her feet took '))).toBe('two paragraphs joined after “…feet took her.”')
    expect(changeSaid(c('She went.', '', ''), true)).toBe('moved “She went.”')
    // A long one is cut at a word.
    expect(changeSaid(c('', 'a sentence long enough that it will not fit on the one line the cover note gives each change at all'))).toBe(
      'put in “a sentence long enough that it will not fit on the one line the cover…” after “…before it,”')
  })
})

describe('a declined join or split is one change (T18.2)', () => {
  const A = 'She went to the watch house first. She did not think about it. Her feet took her.'
  const B = 'Captain Orrin was not there. A sergeant with a cold told her the hearing had been put back.'
  const shown = (paras: MarkedParagraph[]) => paras.map((p) => `${p.mark}${p.joins ? `(${p.breakMark}${p.declined ? ', declined' : ''})` : ''}:${p.runs.map((r) => (r.kind === 'same' ? r.text : `[${r.kind} ${r.text}]`)).join('')}`)

  it('a split with its words as they were is a break put in, and the space taken out; a join the break taken out', () => {
    expect(shown(markedParagraphs(`${A} ${B}`, `${A}\n\n${B}`))).toEqual([`same(ins):${A}[del  ]`, `same:${B}`])
    expect(shown(markedParagraphs(`${A}\n\n${B}`, `${A} ${B}`))).toEqual([`same(del):${A}[ins  ]`, `same:${B}`])
    expect(changeCount(markedParagraphs(`${A}\n\n${B}`, `${A} ${B}`))).toBe(1)
    // Only where the words are as they were: an edit in either half pairs the paragraphs as before.
    expect(markedParagraphs(`${A} ${B}`, `${A}\n\n${B.replace('cold', 'cough')}`).some((p) => p.joins)).toBe(false)
  })

  /** The editor's text, the writer's, and the scene as it went, in a marked file read back by the app; and a comment's words, where one is on them. */
  async function sent(editor: string, writer: string, went: string, commentOn?: string) {
    const threads = commentOn ? [{ eventId: 'e', quote: commentOn, done: false, comments: [{ author: 'Ana Editor', initials: 'AE', text: 'Good.' }] }] : []
    const paras = markedParagraphs(editor, writer, commentedIn(threads, 'e', writer))
    markDeclined(paras, went)
    const bytes = compileDocx({
      totalWords: 0, totalScenes: 1, writtenScenes: 1,
      chapters: [{ id: 'c', number: 1, title: 'C', synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: 1, scenes: [{ eventId: 'e', title: 'S', text: writer, wordCount: 1, written: true, status: 'draft' }] }],
    }, { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: () => 0, marked: { author: 'Tamsin Hale', date: '2026-11-14T19:18:35Z', base: () => editor, went: () => went, threads } } })
    const xml = new TextDecoder().decode(readStoredZip(bytes).get('word/document.xml'))
    const doc = await readEditedDocx(bytes)
    const [scene] = docScenes(doc)
    const plain = (t: string) => rendered(t).replace(/[*_]/g, '')
    return { paras, xml, rejected: plain(scene.original), accepted: plain(scene.edited), made: plain(docScenes(withChangesMade(doc, 'Tamsin Hale'))[0].original) }
  }

  it('the editor’s join turned back: the break put back, signed as declined, the sentence once; rejected, their paragraph, with none left empty', async () => {
    const f = await sent(`${A} ${B}`, `${A}\n\n${B}`, `${A}\n\n${B}`)
    expect(shown(f.paras)).toEqual([`same(ins, declined):${A}[del  ]`, `same:${B}`])
    expect(f.xml.split('Her feet took her.').length - 1).toBe(1)
    // Every mark in the file is the declined one: none signed plain.
    expect(f.xml).not.toMatch(/w:author="Tamsin Hale"/)
    expect(f.xml.match(/w:author="Tamsin Hale \(edit declined\)"/g)).toHaveLength(2)
    expect(f.rejected).toBe(`${A} ${B}`)
    expect(f.accepted).toBe(`${A}\n\n${B}`)
    expect(f.made).toBe(`${A}\n\n${B}`)
  })

  it('the editor’s split turned back: the break taken out, signed as declined; rejected, their two paragraphs', async () => {
    const f = await sent(`${A}\n\n${B}`, `${A} ${B}`, `${A} ${B}`)
    expect(shown(f.paras)).toEqual([`same(del, declined):${A}[ins  ]`, `same:${B}`])
    expect(f.xml).not.toMatch(/w:author="Tamsin Hale"/)
    expect(f.rejected).toBe(`${A}\n\n${B}`)
    expect(f.accepted).toBe(`${A} ${B}`)
    expect(f.made).toBe(`${A} ${B}`)
  })

  it('with a comment in its first half, marked as before, which LibreOffice takes back; each mark signed as declined', async () => {
    // LibreOffice's Reject All keeps a break marked on a paragraph with a comment in it (npm run probe:marked, T18.2).
    const f = await sent(`${A} ${B}`, `${A}\n\n${B}`, `${A}\n\n${B}`, 'did not think about it')
    expect(f.paras.some((p) => p.joins)).toBe(false)
    expect(f.xml.split('Her feet took her.').length - 1).toBe(2)
    // Its words put in again, and taken out of the paragraph they joined: both read as the edit declined, not one in her own name.
    expect(f.xml).not.toMatch(/w:author="Tamsin Hale"/)
    expect(f.xml).toMatch(/w:author="Tamsin Hale \(edit declined\)"/)
    expect([f.rejected, f.accepted, f.made]).toEqual([`${A} ${B}`, `${A}\n\n${B}`, `${A}\n\n${B}`])
    // In its second half, the break is the change.
    expect((await sent(`${A} ${B}`, `${A}\n\n${B}`, `${A}\n\n${B}`, 'Captain Orrin was not there')).paras.some((p) => p.joins)).toBe(true)
  })

  it('commentedIn: a paragraph holding a comment’s words; every paragraph where one has none in the scene, since it goes at the start', () => {
    const t = (quote: string, outside?: 'heading') => ({ eventId: 'e', quote, ...(outside ? { outside } : {}) })
    const on = commentedIn([t('did not *think* about it'), t('Elsewhere', 'heading'), { eventId: 'x', quote: 'nowhere here' }], 'e', `${A}\n\n${B}`)
    expect([on(A), on(B)]).toEqual([true, false])
    expect(commentedIn([t('words long since rewritten')], 'e', `${A}\n\n${B}`)(B)).toBe(true)
    expect(commentedIn([], 'e', A)(A)).toBe(false)
  })

  it('a split of the writer’s own: signed with her name, one change', async () => {
    const f = await sent(`${A} ${B}`, `${A}\n\n${B}`, `${A} ${B}`)
    expect(f.xml).not.toContain('edit declined')
    expect(f.xml.match(/w:author="Tamsin Hale"/g)).toHaveLength(2)
    expect(changeCount(f.paras)).toBe(1)
    expect([f.rejected, f.accepted]).toEqual([`${A} ${B}`, `${A}\n\n${B}`])
  })

  it('the third loop’s round 2: the declined join in chapter 5 one change, its sentence once', () => {
    const { plan } = planOf('back-1', 'sent-1', 'marked-2')
    const scene = draft('marked-2').book.chapters.flatMap((c) => c.scenes).find((s) => s.text.includes('Her feet took her.'))!
    const paras = markedParagraphs(plan.marked.base(scene.id), scene.text)
    markDeclined(paras, plan.marked.went!(scene.id))
    const k = paras.findIndex((p) => p.runs.some((r) => r.text.includes('Her feet took her.')))
    expect(paras[k]).toMatchObject({ joins: true, breakMark: 'ins', declined: true })
    expect(paras.filter((p) => p.runs.some((r) => r.text.includes('Her feet took her.')))).toHaveLength(1)
  })
})
