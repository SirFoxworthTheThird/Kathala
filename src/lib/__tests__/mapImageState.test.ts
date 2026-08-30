import { describe, it, expect } from 'vitest'
import { mapImageState, probeableAddress, type ImageLoad } from '@/lib/mapImageState'

/**
 * The order of these branches is the whole content of the function, and every
 * wrong order is invisible in a screenshot: reading `loading` as `unreachable`
 * flashes "could not be loaded" on every map before it draws, and reading
 * `unreachable` as `loading` is the bug this was written for — a spinner, or a
 * blank canvas, where an explanation belongs.
 */

const base = { hasImageId: true, missing: false, url: 'https://example.test/m.jpg', load: 'ok' as ImageLoad }

describe('mapImageState', () => {
  it('draws the map when the record is here and the picture loaded', () => {
    expect(mapImageState(base)).toBe('ready')
  })

  it('reports a layer that never had a picture', () => {
    expect(mapImageState({ ...base, hasImageId: false })).toBe('no-image')
  })

  it('reports a picture whose record is not in this database', () => {
    expect(mapImageState({ ...base, missing: true })).toBe('not-downloaded')
  })

  it('reports a picture whose address did not answer', () => {
    expect(mapImageState({ ...base, load: 'failed' })).toBe('unreachable')
  })

  it('waits while the picture is still being fetched', () => {
    expect(mapImageState({ ...base, load: 'loading' })).toBe('loading')
  })

  it('waits while the record itself is still being read', () => {
    // No url yet is the query not having answered. Only `missing` says absent,
    // and treating this as `unreachable` is the flash-on-every-map mistake.
    expect(mapImageState({ ...base, url: undefined, load: 'loading' })).toBe('loading')
  })

  /**
   * Precedence, one pair at a time. Each of these is a state the app really
   * reaches, and each would be reported as the *later* branch if the earlier
   * one were moved down.
   */
  it('prefers no-image over every later answer', () => {
    // A layer with no picture also has no record and no address: without the
    // first branch this reads as not-downloaded.
    expect(mapImageState({ hasImageId: false, missing: true, url: undefined, load: 'failed' }))
      .toBe('no-image')
  })

  it('prefers not-downloaded over unreachable', () => {
    // An absent record yields no url, so `load` is still 'loading' from a fetch
    // that never started — but a stale 'failed' must not win either.
    expect(mapImageState({ hasImageId: true, missing: true, url: undefined, load: 'failed' }))
      .toBe('not-downloaded')
  })

  it('prefers unreachable over loading once there is an address that failed', () => {
    expect(mapImageState({ ...base, load: 'failed' })).not.toBe('loading')
  })
})

/**
 * The rule that cost 77 e2e failures. `URL.createObjectURL` returns a new
 * string each call, so an uploaded image's url is a different value on every
 * render; anything keyed on it never settles, and the map sits on its spinner
 * forever. Only an address that can actually be a dead link is probed.
 */
describe('probeableAddress', () => {
  it('probes a remote address', () => {
    expect(probeableAddress('https://upload.wikimedia.org/a.jpg')).toBe('https://upload.wikimedia.org/a.jpg')
    expect(probeableAddress('http://example.test/a.jpg')).toBe('http://example.test/a.jpg')
  })

  it('does not probe an object url, however many times it is minted', () => {
    // Two different strings for the same uploaded picture, which is exactly
    // what two renders produce.
    expect(probeableAddress('blob:http://localhost:4173/8f2c-1')).toBeNull()
    expect(probeableAddress('blob:http://localhost:4173/8f2c-2')).toBeNull()
  })

  it('does not probe an inlined picture', () => {
    expect(probeableAddress('data:image/png;base64,iVBORw0KGgo=')).toBeNull()
  })

  it('has nothing to probe before the record has been read', () => {
    expect(probeableAddress(undefined)).toBeNull()
  })
})
