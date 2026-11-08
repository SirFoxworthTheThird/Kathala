import { describe, it, expect } from 'vitest'
import { compareDrafts, draftOf, draftWords, type DraftBook } from '@/lib/bookDraft'
import { gzip, gunzip } from '@/lib/gzip'

const P = (...ps: string[]) => ps.join('\n\n')

/** A two-chapter book: c1 holds s1 and s2, c2 holds s3. */
function book(over: (b: DraftBook) => void = () => {}): DraftBook {
  const b: DraftBook = {
    version: 1,
    chapters: [
      { id: 'c1', number: 1, title: 'Low Water', timelineId: 't', scenes: [
        { id: 's1', title: 'Dawn', text: P('The ferry left at dawn.', 'Mira counted the crates.', 'There were eleven.') },
        { id: 's2', title: 'The Quay', text: P('The boy waited on the quay.', 'He had a ledger.') },
      ] },
      { id: 'c2', number: 2, title: 'High Water', timelineId: 't', scenes: [
        { id: 's3', title: 'The Tide', text: P('The tide came in at noon.') },
      ] },
    ],
  }
  over(b)
  return b
}
const scene = (b: DraftBook, id: string) => b.chapters.flatMap((c) => c.scenes).find((s) => s.id === id)!
const summary = (before: DraftBook, after: DraftBook) => compareDrafts(before, after).changes.map((c) => {
  const flags = [c.state !== 'kept' && c.state, c.edited && 'edited', c.renamed && 'renamed', c.moved && 'moved',
    c.splitFrom && `split from ${c.splitFrom}`, c.joinedInto && `joined into ${c.joinedInto}`,
    c.splitInto && `split into ${c.splitInto.join(' ')}`, c.tookIn && `took in ${c.tookIn.join(' ')}`].filter(Boolean)
  return `${c.sceneId}: ${flags.join(', ')}`
})

describe('compareDrafts', () => {
  it('says nothing of a book that has not changed', () => {
    expect(compareDrafts(book(), book()).changes).toEqual([])
  })

  it('names an edited scene, with its words before and after', () => {
    const after = book((b) => { scene(b, 's2').text = P('The boy waited on the quay, shivering.', 'He had a ledger.') })
    const [c] = compareDrafts(book(), after).changes
    expect(c).toMatchObject({ sceneId: 's2', state: 'kept', edited: true, moved: false, renamed: false, chapter: 1, chapterBefore: 1, wordsBefore: 10, wordsAfter: 11 })
    expect(compareDrafts(book(), after)).toMatchObject({ wordsBefore: 28, wordsAfter: 29 })
  })

  it('names a renamed scene, keeping its old title', () => {
    const after = book((b) => { scene(b, 's1').title = 'Departure' })
    expect(compareDrafts(book(), after).changes[0]).toMatchObject({ sceneId: 's1', renamed: true, edited: false, title: 'Departure', titleBefore: 'Dawn' })
  })

  it('names a scene moved to another chapter, and one moved out of order, and only those', () => {
    const toC2 = book((b) => { const [s2] = b.chapters[0].scenes.splice(1, 1); b.chapters[1].scenes.unshift(s2) })
    expect(summary(book(), toC2)).toEqual(['s2: moved'])
    expect(compareDrafts(book(), toC2).changes[0]).toMatchObject({ chapter: 2, chapterBefore: 1 })
    // s2 before s1, same chapter: one of them moved, not both.
    const swapped = book((b) => { b.chapters[0].scenes.reverse() })
    expect(summary(book(), swapped)).toHaveLength(1)
    expect(summary(book(), swapped)[0]).toMatch(/^s[12]: moved$/)
  })

  it('recognises a split: the first half kept and edited, the rest a new scene that came from it', () => {
    const after = book((b) => {
      scene(b, 's1').text = P('The ferry left at dawn.')
      b.chapters[0].scenes.splice(1, 0, { id: 'new', title: 'Counting', text: P('Mira counted the crates.', 'There were eleven.') })
    })
    expect(summary(book(), after)).toEqual(['s1: edited, split into new', 'new: added, split from s1'])
  })

  it('recognises a join: the scene gone, joined into the one that has its prose now', () => {
    const after = book((b) => {
      scene(b, 's1').text = P(scene(b, 's1').text, scene(b, 's2').text)
      b.chapters[0].scenes.splice(1, 1)
    })
    expect(summary(book(), after)).toEqual(['s1: edited, took in s2', 's2: removed, joined into s1'])
  })

  it('a join whose prose was edited since is still a join, while half of it is there', () => {
    const after = book((b) => {
      scene(b, 's1').text = P(scene(b, 's1').text, 'The boy waited on the quay, shivering.', 'He had a ledger.')
      b.chapters[0].scenes.splice(1, 1)
    })
    expect(summary(book(), after)).toEqual(['s1: edited, took in s2', 's2: removed, joined into s1'])
  })

  it('a scene added or removed is that, where its prose came from nowhere or went nowhere', () => {
    const added = book((b) => { b.chapters[1].scenes.push({ id: 'new', title: 'Night', text: 'The lamps were lit.' }) })
    expect(summary(book(), added)).toEqual(['new: added'])
    const removed = book((b) => { b.chapters[1].scenes = [] })
    expect(summary(book(), removed)).toEqual(['s3: removed'])
    // A new scene repeating a paragraph that is still where it was is not a split.
    const copied = book((b) => { b.chapters[1].scenes.push({ id: 'new', title: 'Echo', text: 'The tide came in at noon.' }) })
    expect(summary(book(), copied)).toEqual(['new: added'])
  })
})

describe('draftOf', () => {
  it('builds the book from its records: chapters in the order given, scenes by their order, prose where there is some', () => {
    const b = draftOf(
      [{ id: 'c2', number: 2, title: 'B', timelineId: 't' }, { id: 'c1', number: 1, title: 'A', timelineId: 't' }],
      [{ id: 'y', chapterId: 'c1', sortOrder: 2, title: 'Y' }, { id: 'x', chapterId: 'c1', sortOrder: 1, title: 'X' }, { id: 'z', chapterId: 'c2', sortOrder: 0, title: 'Z' }],
      [{ eventId: 'x', text: 'One two.' }, { eventId: 'z', text: 'Three.' }],
    )
    expect(b.chapters.map((c) => [c.id, c.scenes.map((s) => `${s.id}:${s.text}`)])).toEqual([['c2', ['z:Three.']], ['c1', ['x:One two.', 'y:']]])
    expect(draftWords(b)).toBe(3)
  })
})

describe('gzip', () => {
  it('round-trips, and makes a book’s worth of prose smaller', async () => {
    const text = new TextEncoder().encode(JSON.stringify(book()).repeat(200))
    const packed = await gzip(text)
    expect(packed.length).toBeLessThan(text.length / 10)
    expect(new TextDecoder().decode(await gunzip(packed))).toBe(new TextDecoder().decode(text))
  })
})
