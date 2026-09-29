import { describe, it, expect } from 'vitest'
import { planSync, bookToShow, pendingWrites, afterWrite, storedValues, type Held } from '@/lib/draftSync'
import type { DraftChapter } from '@/lib/draftDocument'

const book = (letter = 'Wait and hope.', title = 'The letter'): DraftChapter[] => [
  { id: 'c1', title: 'Arrival', scenes: [
    { id: 's1', title: 'The quay', text: 'The ship came in.' },
    { id: 's2', title, text: letter },
  ] },
]
const edited = (values: Map<string, Held>, id: string, patch: Partial<Held>) => {
  const next = new Map(values)
  next.set(id, { ...next.get(id)!, ...patch })
  return next
}
const none = new Set<string>()

describe('planSync', () => {
  const base = storedValues(book())

  it('does nothing when the store holds what the page last knew', () => {
    const plan = planSync(storedValues(book()), base, base, none)
    expect(plan).toEqual({ restructure: false, take: [], base })
  })

  it('takes a change made elsewhere to a scene the writer has not touched', () => {
    const plan = planSync(storedValues(book('Changed in another tab.')), base, base, none)
    expect(plan.take).toEqual(['s2'])
    expect(plan.base.get('s2')!.text).toBe('Changed in another tab.')
  })

  it('keeps what the writer typed over a change made elsewhere, and still owes the store a write', () => {
    const shown = edited(base, 's2', { text: 'Typed here.' })
    const plan = planSync(storedValues(book('Changed in another tab.')), base, shown, none)
    expect(plan.take).toEqual([])
    expect(pendingWrites(plan.base, shown)).toEqual([{ id: 's2', kind: 'scene', text: 'Typed here.' }])
  })

  it('does not mistake its own write, not yet landed, for somebody else’s', () => {
    // The page wrote "Typed here." and set its base; the store still has the old text.
    const shown = edited(base, 's2', { text: 'Typed here.' })
    const written = afterWrite(base, { id: 's2', kind: 'scene', text: 'Typed here.' })
    const stale = storedValues(book())
    expect(planSync(stale, written, shown, new Set(['s2'])).take).toEqual([])
    // Without the in-flight mark the stale store is taken, and the text just
    // typed would be replaced by the text it replaced. This is what the mark is for.
    expect(planSync(stale, written, shown, none).take).toEqual(['s2'])
  })

  it('does not read its own whitespace-only prose, deleted on save, as a change made elsewhere', () => {
    // The writer left a scene holding only spaces; storing that deletes the
    // record, which reads back as no prose at all.
    const written = afterWrite(base, { id: 's2', kind: 'scene', text: '   ' })
    expect(planSync(storedValues(book('')), written, written, none).take).toEqual([])
    // A real change made elsewhere is still taken.
    expect(planSync(storedValues(book('Real prose.')), written, written, none).take).toEqual(['s2'])
  })

  it('does not read a title that differs only by spaces at its ends as changed', () => {
    const written = afterWrite(base, { id: 's2', kind: 'scene', title: 'The letter ' })
    expect(planSync(storedValues(book()), written, written, none).take).toEqual([])
    expect(planSync(storedValues(book('Wait and hope.', 'A letter')), written, written, none).take).toEqual(['s2'])
  })

  it('knows when the chapters or scenes, or their order, are not the ones shown', () => {
    const reordered: DraftChapter[] = [{ ...book()[0], scenes: [...book()[0].scenes].reverse() }]
    expect(planSync(storedValues(reordered), base, base, none).restructure).toBe(true)
    const added: DraftChapter[] = [{ ...book()[0], scenes: [...book()[0].scenes, { id: 's9', title: 'New', text: '' }] }]
    const plan = planSync(storedValues(added), base, base, none)
    expect(plan.restructure).toBe(true)
    expect(plan.base.get('s9')).toEqual({ kind: 'scene', title: 'New', text: '' })
    expect(planSync(storedValues(book()), base, base, none).restructure).toBe(false)
  })
})

describe('bookToShow', () => {
  const base = storedValues(book())
  it('shows the store, except a heading the writer has changed and not saved', () => {
    const shown = edited(base, 's1', { text: 'Unsaved.' })
    const out = bookToShow(book('Changed elsewhere.'), base, shown, new Set(['s2']))
    expect(out[0].scenes.map((s) => s.text)).toEqual(['Unsaved.', 'Changed elsewhere.'])
  })

  it('shows every scene’s header line as the records draw it, the scene the writer changed too', () => {
    const headed: DraftChapter[] = [{ ...book()[0], scenes: book()[0].scenes.map((s) => ({ ...s, header: `[@@${s.id}]` })) }]
    const shown = edited(base, 's1', { text: 'Unsaved.' })
    const out = bookToShow(headed, base, shown, none)
    expect(out[0].scenes.map((s) => [s.header, s.text])).toEqual([['[@@s1]', 'Unsaved.'], ['[@@s2]', 'Wait and hope.']])
  })
})

describe('pendingWrites', () => {
  const base = storedValues(book())
  it('writes a renamed title clean, and prose as typed', () => {
    const shown = edited(edited(base, 's2', { title: '  A letter  ' }), 's1', { text: 'The ship came in.\n' })
    expect(pendingWrites(base, shown)).toEqual([
      { id: 's1', kind: 'scene', text: 'The ship came in.\n' },
      { id: 's2', kind: 'scene', title: 'A letter' },
    ])
  })
  it('never writes an empty scene title, but will an empty chapter title', () => {
    const shown = edited(edited(base, 's2', { title: '' }), 'c1', { title: '' })
    expect(pendingWrites(base, shown)).toEqual([{ id: 'c1', kind: 'chapter', title: '' }])
  })
  it('writes nothing when nothing changed', () => {
    expect(pendingWrites(base, base)).toEqual([])
  })
})
