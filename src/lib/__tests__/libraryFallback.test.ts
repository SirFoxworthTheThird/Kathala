import { describe, it, expect, vi } from 'vitest'
import { withBundledFallback, swapBase } from '../libraryFallback'

const ok = (body = '{}') => new Response(body, { status: 200 })
const notFound = () => new Response('', { status: 404 })
const REMOTE = 'https://books.example/library/'
const BUNDLED = './library/'

/**
 * A desktop install wants two things that pull apart: to see books published
 * after it was built, and to open the Library on a train. So it asks the site
 * and keeps what it shipped with for when the site cannot be reached.
 */
describe('withBundledFallback', () => {
  it('is the plain fetcher when there is nothing bundled', async () => {
    const fetcher = vi.fn(async () => ok())
    const f = withBundledFallback({ remote: REMOTE, bundled: undefined, fetcher })
    // Identity, not a wrapper: a browser build was served over a network, so it
    // already has the only fallback that means anything.
    expect(f).toBe(fetcher)
  })

  it('uses the site when the site answers', async () => {
    const fetcher = vi.fn(async () => ok('{"from":"site"}'))
    const f = withBundledFallback({ remote: REMOTE, bundled: BUNDLED, fetcher })
    const res = await f(`${REMOTE}index.json`)
    expect(await res.json()).toEqual({ from: 'site' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(`${REMOTE}index.json`)
  })

  it('falls back to the shipped copy when the site refuses', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.startsWith(REMOTE) ? notFound() : ok('{"from":"bundled"}'))
    const f = withBundledFallback({ remote: REMOTE, bundled: BUNDLED, fetcher })
    expect(await (await f(`${REMOTE}index.json`)).json()).toEqual({ from: 'bundled' })
    expect(fetcher).toHaveBeenLastCalledWith('./library/index.json')
  })

  it('falls back when the site cannot be reached at all', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.startsWith(REMOTE)) throw new TypeError('Failed to fetch')
      return ok('{"from":"bundled"}')
    })
    const f = withBundledFallback({ remote: REMOTE, bundled: BUNDLED, fetcher })
    expect(await (await f(`${REMOTE}index.json`)).json()).toEqual({ from: 'bundled' })
  })

  it('falls back when the site hangs rather than failing', async () => {
    // A captive portal or a dead VPN answers nothing at all. Without a timeout
    // the Library spins with a perfectly good copy of every book on disk.
    const fetcher = vi.fn(async (url: string) => {
      if (url.startsWith(REMOTE)) return new Promise<Response>(() => {})
      return ok('{"from":"bundled"}')
    })
    const f = withBundledFallback({ remote: REMOTE, bundled: BUNDLED, fetcher, timeoutMs: 20 })
    expect(await (await f(`${REMOTE}index.json`)).json()).toEqual({ from: 'bundled' })
  })

  it("leaves somebody else's URL alone, because there is no local copy of it", async () => {
    // A cover hosted on Wikimedia has no bundled counterpart; rewriting it
    // would invent a path that has never existed.
    const fetcher = vi.fn(async () => notFound())
    const f = withBundledFallback({ remote: REMOTE, bundled: BUNDLED, fetcher })
    const res = await f('https://upload.wikimedia.org/cover.jpg')
    expect(res.status).toBe(404)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith('https://upload.wikimedia.org/cover.jpg')
  })
})

describe('swapBase', () => {
  it('repoints a URL and keeps everything after the base', () => {
    expect(swapBase(`${REMOTE}dracula.pwk`, REMOTE, './library/'))
      .toBe('./library/dracula.pwk')
  })

  it('leaves a URL that is not on the base untouched', () => {
    expect(swapBase('https://elsewhere.example/x.png', REMOTE, './library/'))
      .toBe('https://elsewhere.example/x.png')
  })

  it('does not mangle the // in https://', () => {
    expect(swapBase(`${REMOTE}a.pwk`, REMOTE, 'https://mirror.example/library/'))
      .toBe('https://mirror.example/library/a.pwk')
  })
})
