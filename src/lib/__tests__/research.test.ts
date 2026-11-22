import { describe, it, expect } from 'vitest'
import {
  attached, byOrder, detached, fileProblem, filesTotal, formatBytes, isLoose, linkProblem, MAX_FILE_BYTES, moved, researchMatches,
} from '@/lib/research'
import type { ResearchItem } from '@/types'

/**
 * Research and reference material (issue #700, research-plan.md): what a file
 * may be (D-2), what a link may be, the attachment rules (D-5), and how the
 * Research list is filtered and searched.
 */

const item = (over: Partial<ResearchItem>): ResearchItem => ({
  id: 'r', worldId: 'w', kind: 'clip', title: '', note: '', attachedTo: [], toWorld: false, order: 0, createdAt: 0, updatedAt: 0, ...over,
})

describe('a research file', () => {
  it('is an image or a PDF of at most 20 MB, and anything else is refused with why', () => {
    expect(fileProblem({ name: 'harbour.jpg', type: 'image/jpeg', size: 1_000_000 })).toBeNull()
    expect(fileProblem({ name: 'charter.pdf', type: 'application/pdf', size: MAX_FILE_BYTES })).toBeNull()
    expect(fileProblem({ name: 'charter.pdf', type: 'application/pdf', size: MAX_FILE_BYTES + 1 }))
      .toBe('“charter.pdf” is 20 MB. A research file can be at most 20 MB, so a backup of the book still opens.')
    expect(fileProblem({ name: 'notes.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 10 }))
      .toMatch(/^“notes.docx” is not an image or a PDF/)
    expect(fileProblem({ name: 'x', type: '', size: 1 })).toMatch(/not an image or a PDF/)
  })

  it('a size reads as a writer would say it', () => {
    expect([formatBytes(512), formatBytes(2048), formatBytes(1.5 * 1024 * 1024), formatBytes(25 * 1024 * 1024)]).toEqual(['512 bytes', '2 KB', '1.5 MB', '25 MB'])
  })

  it('a backup’s files come to the files’ sizes, and nothing for a link or a clipping', () => {
    expect(filesTotal([item({ kind: 'file', size: 10 }), item({ kind: 'file', size: 5 }), item({ kind: 'link', size: 99 }), item({ kind: 'clip' })])).toBe(15)
  })
})

describe('a research link', () => {
  it('is a web address, which is never fetched', () => {
    expect(linkProblem('https://example.org/harbour')).toBeNull()
    expect(linkProblem('http://example.org')).toBeNull()
    expect(linkProblem('  ')).toBe('A link needs an address.')
    expect(linkProblem('example.org')).toMatch(/^That is not a web address/)
    expect(linkProblem('javascript:alert(1)')).toBe('A link’s address starts with http:// or https://.')
    expect(linkProblem('file:///etc/passwd')).toBe('A link’s address starts with http:// or https://.')
  })
})

describe('attachments', () => {
  it('a record is attached once, and taken off alone', () => {
    const a = attached(attached([], { kind: 'scene', id: 's1' }), { kind: 'scene', id: 's1' })
    expect(a).toEqual([{ kind: 'scene', id: 's1' }])
    const b = attached(a, { kind: 'place', id: 's1' })
    expect(b).toHaveLength(2)
    expect(detached(b, { kind: 'scene', id: 's1' })).toEqual([{ kind: 'place', id: 's1' }])
  })

  it('attached to nothing is not attached to the world', () => {
    expect(isLoose(item({}))).toBe(true)
    expect(isLoose(item({ toWorld: true }))).toBe(false)
    expect(isLoose(item({ attachedTo: [{ kind: 'item', id: 'i' }] }))).toBe(false)
  })
})

describe('the Research list', () => {
  const items = [
    item({ id: 'img', kind: 'file', mimeType: 'image/png', title: 'Harbour at dawn', attachedTo: [{ kind: 'place', id: 'quay' }] }),
    item({ id: 'pdf', kind: 'file', mimeType: 'application/pdf', title: 'Salt duty, 1811', note: 'Tables of the excise', toWorld: true }),
    item({ id: 'lnk', kind: 'link', title: 'Tide tables', url: 'https://tides.example.org/saltmouth', attachedTo: [{ kind: 'scene', id: 's1' }] }),
    item({ id: 'clp', kind: 'clip', title: 'A weigher’s oath', text: 'I shall weigh true and keep the ledger open.', source: 'Guild rules, 1790' }),
  ]
  const ids = (f: Parameters<typeof researchMatches>[1]) => items.filter((i) => researchMatches(i, f)).map((i) => i.id)

  it('filters by kind: images and PDFs apart, links, clippings', () => {
    expect(ids({ kind: 'image' })).toEqual(['img'])
    expect(ids({ kind: 'pdf' })).toEqual(['pdf'])
    expect(ids({ kind: 'file' })).toEqual(['img', 'pdf'])
    expect(ids({ kind: 'link' })).toEqual(['lnk'])
    expect(ids({ kind: 'clip' })).toEqual(['clp'])
    expect(ids({})).toEqual(['img', 'pdf', 'lnk', 'clp'])
  })

  it('filters by what an item is on: a record, a kind of record, the world, or nothing', () => {
    expect(ids({ on: { kind: 'place', id: 'quay' } })).toEqual(['img'])
    expect(ids({ on: { kind: 'place', id: 'elsewhere' } })).toEqual([])
    expect(ids({ on: { kind: 'scene' } })).toEqual(['lnk'])
    expect(ids({ on: 'world' })).toEqual(['pdf'])
    expect(ids({ on: 'nothing' })).toEqual(['clp'])
  })

  it('searches titles, notes, clippings, sources and addresses', () => {
    expect(ids({ query: 'excise' })).toEqual(['pdf'])
    expect(ids({ query: 'ledger open' })).toEqual(['clp'])
    expect(ids({ query: 'guild rules' })).toEqual(['clp'])
    expect(ids({ query: 'tides.example' })).toEqual(['lnk'])
    expect(ids({ query: 'dawn', kind: 'link' })).toEqual([])
    expect(ids({ query: 'weigh', wholeWord: true })).toEqual(['clp'])
    expect(ids({ query: 'weig', wholeWord: true })).toEqual([])
  })

  it('keeps its order, and a drag moves one item to where it is dropped', () => {
    const list = [item({ id: 'a', order: 2 }), item({ id: 'b', order: 0 }), item({ id: 'c', order: 1 })].sort(byOrder)
    expect(list.map((i) => i.id)).toEqual(['b', 'c', 'a'])
    expect(moved(list, 'a', 0).map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(moved(list, 'b', 9).map((i) => i.id)).toEqual(['c', 'a', 'b'])
    expect(moved(list, 'nope', 0).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
})
