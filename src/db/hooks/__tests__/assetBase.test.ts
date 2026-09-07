import { describe, it, expect, afterEach, vi } from 'vitest'
import { blobEntryUrl, resolveBundledAsset } from '@/db/hooks/useBlobs'
import type { BlobEntry } from '@/types'

const linked = (url: string): BlobEntry =>
  ({ id: 'b', worldId: 'w', mimeType: 'image/png', url, createdAt: 0 })

/**
 * A stored `library/…` path is resolved against a base, and which base decides
 * whether the desktop app carries a gigabyte of artwork or fetches it.
 *
 * The web build resolves against the document, as it always has. The desktop
 * build sets `VITE_ASSET_BASE_URL` to a CDN copy. What must not happen either
 * way is a base being pasted onto a link that already names its own host —
 * that would rewrite a reader's third-party image URL into a nonsense one.
 */
describe('resolveBundledAsset', () => {
  it('joins a base to a stored path', () => {
    expect(resolveBundledAsset('library/x/a.png', '/')).toBe('/library/x/a.png')
    expect(resolveBundledAsset('library/x/a.png', './')).toBe('./library/x/a.png')
  })

  it('leaves the // in https:// alone while still collapsing a doubled slash', () => {
    // The reason the expression is written the way it is: a naive collapse
    // turns the CDN base into `https:/cdn…` and every picture 404s.
    expect(resolveBundledAsset('library/a.png', 'https://cdn.example/gh/o/r@v1/public/'))
      .toBe('https://cdn.example/gh/o/r@v1/public/library/a.png')
    expect(resolveBundledAsset('/library/a.png', 'https://cdn.example/public/'))
      .toBe('https://cdn.example/public/library/a.png')
  })
})

describe('blobEntryUrl and the asset base', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('resolves a shipped path against the document when no base is set', () => {
    expect(blobEntryUrl(linked('library/oz/art/cover.jpg'))).toBe('/library/oz/art/cover.jpg')
  })

  it('resolves a shipped path against the CDN when the desktop build sets one', () => {
    vi.stubEnv('VITE_ASSET_BASE_URL', 'https://cdn.jsdelivr.net/gh/o/r@v1.1.0/public/')
    expect(blobEntryUrl(linked('library/oz/art/cover.jpg')))
      .toBe('https://cdn.jsdelivr.net/gh/o/r@v1.1.0/public/library/oz/art/cover.jpg')
  })

  it("leaves a reader's own external link alone, base or no base", () => {
    vi.stubEnv('VITE_ASSET_BASE_URL', 'https://cdn.jsdelivr.net/gh/o/r@v1.1.0/public/')
    expect(blobEntryUrl(linked('https://example.com/mine.png'))).toBe('https://example.com/mine.png')
    // A root-absolute path is somebody's deliberate choice too (DEC-1).
    expect(blobEntryUrl(linked('/held/here.png'))).toBe('/held/here.png')
  })
})
