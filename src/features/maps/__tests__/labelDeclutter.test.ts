import { describe, it, expect } from 'vitest'
import { labelledMarkers } from '../labelDeclutter'

/**
 * The shipped Fellowship opened with 9 overlapping label pairs out of 11
 * markers. The map already had a dot-only icon mode and an all-or-nothing
 * "labels off" filter, but nothing in between, so reading a crowded map meant
 * losing every name on it.
 */
describe('labelledMarkers', () => {
  const at = (id: string, x: number, y: number, name = 'Somewhere') => ({ id, x, y, name })

  it('keeps every label when markers are far apart', () => {
    const markers = [at('a', 0, 0), at('b', 1000, 0), at('c', 0, 1000)]
    expect(labelledMarkers(markers, 0).size).toBe(3)
  })

  it('drops labels that would bury a neighbour', () => {
    // Three pins a few pixels apart: their pills cannot all fit.
    const markers = [at('a', 100, 100), at('b', 104, 100), at('c', 108, 100)]
    const kept = labelledMarkers(markers, 0)
    expect(kept.size).toBe(1)
    // Paired with the case above, so "drops labels" cannot pass by dropping all
    // of them everywhere.
    expect(labelledMarkers([at('a', 0, 0), at('b', 1000, 0)], 0).size).toBe(2)
  })

  it('gives the labels back as you zoom in', () => {
    const markers = [at('a', 100, 100), at('b', 140, 100)]
    expect(labelledMarkers(markers, 0).size).toBe(1)
    // Two zoom levels in, the same pins are four times further apart on screen.
    expect(labelledMarkers(markers, 2).size).toBe(2)
  })

  it('keeps the selected marker labelled even in a crowd', () => {
    const markers = [at('a', 100, 100), at('b', 104, 100), at('c', 108, 100)]
    expect(labelledMarkers(markers, 0, ['c']).has('c')).toBe(true)
    // And without the exemption it is exactly the one that loses out.
    expect(labelledMarkers(markers, 0).has('c')).toBe(false)
  })

  it('is stable: the same input gives the same answer', () => {
    const markers = [at('c', 108, 100), at('a', 100, 100), at('b', 104, 100)]
    const first = [...labelledMarkers(markers, 0)]
    const shuffled = [markers[2], markers[0], markers[1]]
    expect([...labelledMarkers(shuffled, 0)]).toEqual(first)
  })

  it('accounts for longer names needing wider pills', () => {
    // 300px apart: a short name's pill clears it, a long one's does not. The
    // pill has an 88px floor, so this is about the name, not the gap.
    const LONG = 'Hogwarts School of Witchcraft and Wizardry'
    const short = [at('a', 100, 100, 'Bree'), at('b', 400, 100, 'Bree')]
    const long = [at('a', 100, 100, LONG), at('b', 400, 100, LONG)]
    expect(labelledMarkers(short, 0).size).toBe(2)
    expect(labelledMarkers(long, 0).size).toBe(1)
  })
})

/**
 * MW-4: a region polygon writes its own name across the middle of what it
 * covers, so a pin of the same name standing inside it has its name said twice
 * — *Rohan* on the polygon and *Rohan / Region* on the pill, overlapping in the
 * shipped Fellowship.
 */
describe('labelledMarkers and region polygons', () => {
  const at = (id: string, x: number, y: number, name: string) => ({ id, x, y, name })
  /** A square from (0,0) to (size,size). */
  const square = (name: string, size = 500, ox = 0, oy = 0) => ({
    name,
    vertices: [
      { x: ox, y: oy }, { x: ox + size, y: oy },
      { x: ox + size, y: oy + size }, { x: ox, y: oy + size },
    ],
  })

  it('drops the pin label when the region of that name contains it', () => {
    const kept = labelledMarkers([at('rohan', 250, 250, 'Rohan')], 0, [], [square('Rohan')])
    expect(kept.has('rohan')).toBe(false)
  })

  it('keeps it when no region names it, which is the same pin either way', () => {
    // The pairing: identical marker, identical position, no matching region.
    const kept = labelledMarkers([at('rohan', 250, 250, 'Rohan')], 0, [], [square('Gondor')])
    expect(kept.has('rohan')).toBe(true)
  })

  it('keeps a same-named pin that stands outside the region', () => {
    // Two places can share a name on one map. Hiding the label of a pin that
    // stands somewhere else entirely would be a worse fault than the one being
    // fixed, so containment is tested rather than the name alone.
    const kept = labelledMarkers([at('far', 900, 900, 'Rohan')], 0, [], [square('Rohan')])
    expect(kept.has('far')).toBe(true)
  })

  it('ignores case and surrounding space in the name', () => {
    const kept = labelledMarkers([at('r', 250, 250, '  rohan ')], 0, [], [square('Rohan')])
    expect(kept.has('r')).toBe(false)
  })

  it('still labels a selected pin, because that is the one being asked about', () => {
    const kept = labelledMarkers([at('rohan', 250, 250, 'Rohan')], 0, ['rohan'], [square('Rohan')])
    expect(kept.has('rohan')).toBe(true)
  })

  it('ignores a degenerate region that cannot contain anything', () => {
    const line = { name: 'Rohan', vertices: [{ x: 0, y: 0 }, { x: 500, y: 500 }] }
    expect(labelledMarkers([at('rohan', 250, 250, 'Rohan')], 0, [], [line]).has('rohan')).toBe(true)
  })

  it('leaves other pins in the region alone', () => {
    // Only the duplicated name goes; Edoras inside Rohan is not a duplicate.
    const kept = labelledMarkers(
      [at('edoras', 250, 250, 'Edoras')], 0, [], [square('Rohan')],
    )
    expect(kept.has('edoras')).toBe(true)
  })
})
