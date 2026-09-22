import { describe, it, expect, afterEach, vi } from 'vitest'
import { blobEntryUrl, resolveBundledAsset } from '@/db/hooks/useBlobs'
import type { BlobEntry } from '@/types'

const linked = (url: string): BlobEntry =>
  ({ id: 'b', worldId: 'w', mimeType: 'image/png', url, createdAt: 0 })

/**
 * A world stores its pictures as paths, not URLs — `library/oz/art/cover.jpg` —
 * and something has to say where that is.
 *
 * It used to be the document: the books lived in this repository and resolved
 * against whatever served the page. They live in their own repository now, and
 * the app fetches them from the library site, so a stored path is joined to
 * that instead. The end-to-end suite overrides the base to its own preview
 * server, which is why this is configurable rather than a constant.
 *
 * What must not happen either way is a base being pasted onto a link that
 * already names its own host — that would rewrite a reader's third-party image
 * URL into a nonsense one.
 */
describe('resolveBundledAsset', () => {
  it('joins a base to a stored path', () => {
    expect(resolveBundledAsset('library/x/a.png', '/')).toBe('/library/x/a.png')
    expect(resolveBundledAsset('library/x/a.png', './')).toBe('./library/x/a.png')
  })

  it('leaves the // in https:// alone while still collapsing a doubled slash', () => {
    // The reason the expression is written the way it is: a naive collapse
    // turns the site base into `https:/kathala…` and every picture 404s.
    expect(resolveBundledAsset('library/a.png', 'https://books.example/'))
      .toBe('https://books.example/library/a.png')
    expect(resolveBundledAsset('/library/a.png', 'https://books.example/'))
      .toBe('https://books.example/library/a.png')
  })
})

describe('blobEntryUrl and the library site', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('resolves a shipped path against the library site', () => {
    expect(blobEntryUrl(linked('library/oz/art/cover.jpg')))
      .toBe('https://kathala-library.netlify.app/library/oz/art/cover.jpg')
  })

  it('follows the base it is given, which is how the suite serves books locally', () => {
    vi.stubEnv('VITE_LIBRARY_BASE_URL', './')
    expect(blobEntryUrl(linked('library/oz/art/cover.jpg'))).toBe('./library/oz/art/cover.jpg')
  })

  it("leaves a reader's own external link alone, base or no base", () => {
    expect(blobEntryUrl(linked('https://example.com/mine.png'))).toBe('https://example.com/mine.png')
    // A root-absolute path is somebody's deliberate choice too (DEC-1).
    expect(blobEntryUrl(linked('/held/here.png'))).toBe('/held/here.png')
  })
})
