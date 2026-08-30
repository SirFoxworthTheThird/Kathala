import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { db } from '@/db/database'
import { saveImageLocally, saveWorldImagesLocally, linkedBlobs } from '@/db/hooks/useBlobs'

/**
 * Copying a linked picture into the world, and — the half that matters —
 * reporting honestly when the site will not let us.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
  vi.unstubAllGlobals()
})

const link = (id: string, url: string) =>
  db.blobs.add({ id, worldId: 'w', mimeType: 'image/jpeg', url, createdAt: 0 })

/** A `fetch` that succeeds for some hosts and refuses for others, as the real
 *  web does — CORS is a property of the site, not of the request. */
function stubFetch(allow: (url: string) => boolean, bytes = 1000) {
  vi.stubGlobal('fetch', async (url: string) => {
    if (!allow(String(url))) throw new TypeError('Failed to fetch')
    return {
      ok: true,
      status: 200,
      blob: async () => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }),
    }
  })
}

describe('saveImageLocally', () => {
  it('replaces the link with the bytes, keeping the same record', async () => {
    stubFetch(() => true, 2048)
    await link('b1', 'https://ok.example/a.jpg')

    const size = await saveImageLocally('b1')
    expect(size).toBe(2048)

    const after = await db.blobs.get('b1')
    // The id is untouched, which is what makes every `imageId` pointing here
    // still valid — the whole reason this is cheap.
    expect(after!.id).toBe('b1')
    /*
      `data` is asserted as *present*, not as a Blob. Measured: `fake-indexeddb`
      under jsdom structured-clones a Blob into a plain `{}` — no constructor,
      no `size`, no keys — so `toBeInstanceOf(Blob)` fails here for a reason
      that has nothing to do with the code, and any assertion about its contents
      would be testing the fake rather than the app. The size is checked above
      instead, from the value the function returns before storing.

      Do not "strengthen" this to `toBeInstanceOf`; it was tried.
    */
    expect(after, 'the bytes should be stored').toHaveProperty('data')
    // "Exactly one of data / url is set" has to stay true, or a later reader
    // has to guess which one was meant.
    expect(after!.url).toBeUndefined()
  })

  it('leaves the link alone when the site refuses', async () => {
    stubFetch(() => false)
    await link('b1', 'https://no.example/a.jpg')

    await expect(saveImageLocally('b1')).rejects.toThrow()
    const after = await db.blobs.get('b1')
    expect(after!.url, 'a refusal must not cost the picture').toBe('https://no.example/a.jpg')
    expect(after!.data).toBeUndefined()
  })

  it('refuses an empty file rather than storing one', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true, status: 200, blob: async () => new Blob([], { type: 'image/jpeg' }),
    }))
    await link('b1', 'https://ok.example/a.jpg')
    await expect(saveImageLocally('b1')).rejects.toThrow(/empty/)
    expect((await db.blobs.get('b1'))!.url).toBeTruthy()
  })

  it('is a no-op on a picture that is already local', async () => {
    await db.blobs.add({ id: 'b1', worldId: 'w', mimeType: 'image/jpeg', data: new Blob(['x']), createdAt: 0 })
    expect(await saveImageLocally('b1')).toBe(0)
  })
})

describe('saveWorldImagesLocally', () => {
  it('takes what it can and reports the rest, per site', async () => {
    stubFetch((u) => u.includes('ok.example'), 500)
    await link('b1', 'https://ok.example/1.jpg')
    await link('b2', 'https://ok.example/2.jpg')
    await link('b3', 'https://no.example/3.jpg')
    await link('b4', 'https://also-no.example/4.jpg')
    // Another world's picture, which must not be touched.
    await db.blobs.add({ id: 'other', worldId: 'w2', mimeType: 'image/jpeg', url: 'https://ok.example/x.jpg', createdAt: 0 })

    const result = await saveWorldImagesLocally('w')
    expect(result.saved).toBe(2)
    expect(result.bytes).toBe(1000)
    expect(result.failed.map((f) => f.host).sort()).toEqual(['also-no.example', 'no.example'])

    // The two that worked are bytes; the two that did not are still links.
    expect((await db.blobs.get('b1'))!.url).toBeUndefined()
    expect((await db.blobs.get('b3'))!.url).toBeTruthy()
    // And the other world is untouched, which `where('worldId')` is doing.
    expect((await db.blobs.get('other'))!.url).toBeTruthy()
  })

  it('reports progress for every picture, so a long run can say where it is', async () => {
    stubFetch(() => true)
    await link('b1', 'https://ok.example/1.jpg')
    await link('b2', 'https://ok.example/2.jpg')
    const seen: Array<[number, number]> = []
    await saveWorldImagesLocally('w', (done, total) => seen.push([done, total]))
    expect(seen).toEqual([[1, 2], [2, 2]])
  })

  it('has nothing to do once every picture is local', async () => {
    stubFetch(() => true)
    await link('b1', 'https://ok.example/1.jpg')
    await saveWorldImagesLocally('w')
    expect(await linkedBlobs('w')).toEqual([])
    expect(await saveWorldImagesLocally('w')).toEqual({ saved: 0, failed: [], bytes: 0 })
  })
})
