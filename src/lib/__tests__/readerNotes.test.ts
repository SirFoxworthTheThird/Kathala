import { describe, it, expect } from 'vitest'
import { parseReaderNotes, readerNotesFile, readerNotesFileName, sameReader, READER_NOTES_KIND } from '@/lib/readerNotes'
import type { ProseNote } from '@/types'

/** A beta reader's notes file (editorial-plan.md, R7, D-3): notes only, never the book. */

const note = (over: Partial<ProseNote> = {}): ProseNote => ({
  id: 'n1', worldId: 'w', eventId: 's1', quote: 'the lantern smoked', prefix: 'Mira lit it. ', suffix: ' in the cold.',
  kind: 'note', author: { kind: 'reader' }, body: 'Why smoke?', status: 'open', replies: [], createdAt: 5, updatedAt: 5, reaction: 'lost', ...over,
})

describe('a reader’s notes file', () => {
  it('holds the book’s id and name, the reader, where they read to, and each note’s words — nothing of the book besides', () => {
    const file = readerNotesFile({ worldId: 'w', book: 'The Long Road', reader: '  Ines ', readTo: { eventId: 's4', chapter: 2, scene: 'The gate' }, notes: [note(), note({ id: 'n2', reaction: undefined, body: '' })], sentAt: 9 })
    expect(file).toEqual({
      kind: READER_NOTES_KIND, version: 1, worldId: 'w', book: 'The Long Road', reader: 'Ines', readTo: { eventId: 's4', chapter: 2, scene: 'The gate' }, sentAt: 9,
      notes: [
        { eventId: 's1', quote: 'the lantern smoked', prefix: 'Mira lit it. ', suffix: ' in the cold.', reaction: 'lost', body: 'Why smoke?', createdAt: 5 },
        { eventId: 's1', quote: 'the lantern smoked', prefix: 'Mira lit it. ', suffix: ' in the cold.', body: '', createdAt: 5 },
      ],
    })
    expect(parseReaderNotes(JSON.stringify(file))).toEqual(file)
    expect(readerNotesFileName(file)).toBe('the-long-road-notes-from-ines.json')
  })

  it('says plainly what is wrong with a file that is not one, is damaged, or is from a newer Kathala; drops a reaction it does not know', () => {
    const good = readerNotesFile({ worldId: 'w', book: 'B', reader: 'Ines', readTo: null, notes: [note()], sentAt: 1 })
    expect(() => parseReaderNotes('{')).toThrow('not a reader’s notes file')
    expect(() => parseReaderNotes(JSON.stringify({ ...good, kind: 'kathala-world' }))).toThrow('not a reader’s notes file')
    expect(() => parseReaderNotes(JSON.stringify({ ...good, version: 2 }))).toThrow('newer Kathala')
    expect(() => parseReaderNotes(JSON.stringify({ ...good, reader: '  ' }))).toThrow('damaged')
    expect(() => parseReaderNotes(JSON.stringify({ ...good, notes: [{ ...good.notes[0], quote: '' }] }))).toThrow('damaged')
    expect(parseReaderNotes(JSON.stringify({ ...good, notes: [{ ...good.notes[0], reaction: 'bored' }] })).notes[0].reaction).toBeUndefined()
  })

  it('a reader is the same reader whatever the case or spacing of their name', () => {
    expect(sameReader(' Ines', 'ines ')).toBe(true)
    expect(sameReader('Ines', 'Inês')).toBe(false)
  })
})
