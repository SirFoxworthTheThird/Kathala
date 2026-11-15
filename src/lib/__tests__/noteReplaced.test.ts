import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { placeNotes, replacedBetween } from '@/lib/noteAnchor'
import { markedPlan, rewrittenLine } from '@/lib/markedDocx'
import { compileDocx } from '@/lib/manuscriptExport'
import { readStoredZip } from '@/lib/zip'
import type { DraftBook } from '@/lib/bookDraft'
import type { ProseNote } from '@/types'

/*
  A comment on the words that took its words' place (round-trip-plan-4.md,
  T16; loop-2026-11-14.md, finding 4). Eight of the third loop's forty comments
  went back at their scene's start, the app's line under each. In five, the
  words either side still stood, with the writer's rewrite between them. The
  editor: "on the replacement text when the words are replaced."
*/

const F = path.join(__dirname, 'fixtures/docx/run-2026-11-14-loop3')
type Draft = { id: string; book: DraftBook; editors?: string[]; editorChanges?: never }
const draft = (n: string) => JSON.parse(readFileSync(path.join(F, `draft-${n}.json`), 'utf8')) as Draft
const SENT = Date.parse('2026-11-14T19:18:35Z')
/** The editor's notes as they stood when the round-2 file went, their later replies left out. */
const notes = (JSON.parse(readFileSync(path.join(F, 'notes.json'), 'utf8')) as ProseNote[])
  .filter((n) => n.createdAt < SENT && n.author.kind === 'editor' && !n.outside)
  .map((n) => ({ ...n, replies: n.replies.filter((r) => r.createdAt < SENT) }))
const scenes = draft('marked-2').book.chapters.flatMap((c) => c.scenes).map((s) => ({ eventId: s.id, text: s.text }))

describe('the third loop’s comments, on the book as it went back in round 2', () => {
  it('5 of the 8 that went to their scene’s start are on the words that took their place; 3 are still unplaced', () => {
    const places = placeNotes(notes, scenes)
    const replaced = notes.filter((n) => places.get(n.id)?.replaced).map((n) => {
      const p = places.get(n.id)!
      return [n.quote, scenes.find((s) => s.eventId === p.eventId)!.text.slice(p.from, p.to)]
    })
    expect(replaced).toEqual(expect.arrayContaining([
      ['whose sevens looked like ones', 'whose twos were a byword in the tally room'],
      ['Bottom of the ebb is two hours before dawn.', "Low water's about four in the morning."],
      ["The letter's ash,", 'I burned the letter before you were home,'],
      ['He says he woke and the boat was gone', 'He says he woke because her chain stopped knocking on the wall under your window, and the boat was gone,'],
      ['And a westerly behind it.', 'And a north-easter behind it.'],
    ]))
    expect(replaced).toHaveLength(5)
    expect(notes.filter((n) => !places.get(n.id))).toHaveLength(3)
  })

  it('in the marked file, each of the five is on its new words, with the app’s line saying the words it was made on', () => {
    const back = draft('back-1')
    const plan = markedPlan({ sentBack: { id: back.id, editors: back.editors }, base: back.book, scenes, notes, author: 'Tamsin Hale', now: SENT })
    const all = draft('marked-2').book.chapters.flatMap((c) => c.scenes)
    const index = new Map(all.map((s, i) => [s.id, i]))
    const bytes = compileDocx({
      totalWords: 0, totalScenes: all.length, writtenScenes: all.length,
      chapters: draft('marked-2').book.chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
        scenes: c.scenes.map((s) => ({ eventId: s.id, title: s.title, text: s.text, wordCount: 0, written: true, status: 'draft' as const })) })),
    }, { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: (id) => index.get(id), marked: plan.marked } })
    const zip = readStoredZip(bytes)
    const doc = new TextDecoder().decode(zip.get('word/document.xml'))
    const comments = new TextDecoder().decode(zip.get('word/comments.xml'))
    // The words a comment's range holds in the file, as they read.
    const ranged = (id: string) => (new RegExp(`<w:commentRangeStart w:id="${id}"/>(.*?)<w:commentRangeEnd w:id="${id}"/>`, 's').exec(doc)?.[1] ?? '')
      .replace(/<w:delText[^>]*>[^<]*<\/w:delText>/g, '').replace(/<[^>]+>/g, '')
    for (const [was, now] of [['And a westerly behind it.', 'And a north-easter behind it.'], ["The letter's ash,", 'I burned the letter before you were home,']]) {
      // The app's line, as the file writes it, and the comment it is under: the one before it in the file.
      const line = rewrittenLine(was).replace(/'/g, '&apos;')
      const at = Math.max(comments.indexOf(rewrittenLine(was)), comments.indexOf(line))
      expect(at, was).toBeGreaterThan(-1)
      const id = [...comments.slice(0, at).matchAll(/<w:comment w:id="(\d+)"/g)].at(-2)?.[1]
      expect(ranged(id!), was).toBe(now)
    }
  })
})

describe('replacedBetween', () => {
  const text = 'At the quay. Mira counted the sacks once. The captain said nothing.\n\nNext day.'
  it('what lies between its surroundings, within a paragraph', () => {
    expect(replacedBetween(text, 'At the quay. ', ' The captain')).toEqual({ from: 13, to: 41 })
    expect(text.slice(13, 41)).toBe('Mira counted the sacks once.')
  })
  it('a side empty is the scene’s start or end; both empty is no place', () => {
    expect(replacedBetween('Gone now.', '', '')).toBeNull()
    expect(replacedBetween('She went. Gone now.', 'She went. ', '')).toEqual({ from: 10, to: 19 })
  })
  it('not across a paragraph break, not nothing, not one surrounding gone, and not where two places are as good', () => {
    expect(replacedBetween(text, 'At the quay. ', 'Next day.')).toBeNull()
    expect(replacedBetween('At the quay. The captain said nothing.', 'At the quay. ', 'The captain')).toBeNull()
    expect(replacedBetween(text, 'At the harbour. ', ' The captain')).toBeNull()
    expect(replacedBetween('A. x B. A. y B.', 'A. ', ' B.')).toBeNull()
  })
})
