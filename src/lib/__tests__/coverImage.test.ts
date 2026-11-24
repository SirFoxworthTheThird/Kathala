import { describe, it, expect, vi } from 'vitest'
import { exportableCover } from '@/lib/coverImage'

/*
  UX-2-14: every Library cover is WebP, and the export took only JPEG and PNG,
  so a Library book failed to export with the cover box left ticked.
*/
describe('exportableCover', () => {
  const bytes = (n: number[]) => new Uint8Array(n)

  it('a JPEG or a PNG goes as it is', async () => {
    const reencode = vi.fn()
    for (const type of ['image/jpeg', 'image/png']) {
      const cover = await exportableCover(new Blob([bytes([1, 2, 3])], { type }), reencode)
      expect(cover).toEqual({ data: bytes([1, 2, 3]), mimeType: type })
    }
    expect(reencode).not.toHaveBeenCalled()
  })

  it('a WebP is drawn again as a JPEG, and says so', async () => {
    const reencode = vi.fn(async () => new Blob([bytes([9, 9])], { type: 'image/jpeg' }))
    const cover = await exportableCover(new Blob([bytes([1])], { type: 'image/webp' }), reencode)
    expect(cover).toEqual({ data: bytes([9, 9]), mimeType: 'image/jpeg' })
    expect(reencode).toHaveBeenCalledTimes(1)
  })
})
