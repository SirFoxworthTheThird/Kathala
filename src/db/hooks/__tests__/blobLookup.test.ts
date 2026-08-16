import { describe, it, expect } from 'vitest'
import { blobLookupState } from '@/db/hooks/useBlobs'
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
