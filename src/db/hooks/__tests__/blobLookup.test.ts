import { describe, it, expect } from 'vitest'
import { blobLookupState, blobEntryUrl } from '@/db/hooks/useBlobs'
import type { BlobEntry } from '@/types'

const entry = (over: Partial<BlobEntry> = {}): BlobEntry => ({
  id: 'b1', worldId: 'w', mimeType: 'image/png', createdAt: 0, ...over,
})

/**
 * The Maps screen sat on a spinner forever for a library world downloaded
 * without its image bundle: its layers name blobs that are not in the store,
 * and `useBlobUrl` returns `undefined` for *loading* and for *absent* alike.
 * These three cases are the whole of the distinction.
 */
describe('blobLookupState', () => {
  it('is not missing while the query has yet to answer', () => {
    expect(blobLookupState('b1', undefined)).toEqual({ url: undefined, missing: false })
  })

  it('is missing once the query answers with nothing', () => {
    expect(blobLookupState('b1', null)).toEqual({ url: undefined, missing: true })
  })

  it('is not missing when the blob is there', () => {
    expect(blobLookupState('b1', entry({ url: 'https://example.test/m.png' })))
      .toEqual({ url: 'https://example.test/m.png', missing: false })
  })

  it('is not missing when nothing was asked for', () => {
    // A layer with no `imageId` at all has its own empty state, and must not be
    // told its image failed to arrive.
    expect(blobLookupState(null, null)).toEqual({ url: undefined, missing: false })
    expect(blobLookupState(null, undefined)).toEqual({ url: undefined, missing: false })
  })
})

/**
 * W23-7. A stored url is either a link out to the web, or a file this app
 * ships — and the second kind has to survive being deployed under a path.
 *
 * Four books named their own artwork with absolute `raw.githubusercontent.com`
 * URLs, so 146 MB already in `dist/` was fetched from a branch of a public
 * repository and failed offline. They name the served path now, resolved here
 * against `import.meta.env.BASE_URL`, which is what makes one stored value
 * correct at a domain root, under a GitHub Pages subpath, and in Electron.
 */
describe('blobEntryUrl', () => {
  const BASE = import.meta.env.BASE_URL

  it('resolves a shipped file against the app base', () => {
    expect(blobEntryUrl(entry({ url: 'library/neuromancer/maps/world.svg' })))
      .toBe(`${BASE}library/neuromancer/maps/world.svg`.replace(/([^:]\/)\/+/g, '$1'))
  })

  it('leaves an absolute link alone, whatever the base is', () => {
    // The third-party covers and portraits DEC-1 keeps as links. Rewriting one
    // of these would point it at this app and 404.
    for (const url of [
      'https://commons.wikimedia.org/x.jpg',
      'http://example.test/y.png',
      'data:image/png;base64,AAAA',
      'blob:http://localhost/abc',
    ]) {
      expect(blobEntryUrl(entry({ url }))).toBe(url)
    }
  })

  it('leaves a root-absolute path alone', () => {
    // Already anchored; prefixing the base would double it.
    expect(blobEntryUrl(entry({ url: '/library/x.png' }))).toBe('/library/x.png')
  })

  it('has nothing to say about an entry with neither url nor data', () => {
    expect(blobEntryUrl(entry())).toBeUndefined()
    expect(blobEntryUrl(undefined)).toBeUndefined()
  })
})
