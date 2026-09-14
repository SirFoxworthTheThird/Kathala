import type { Fetcher } from './library'

/**
 * Ask the library site first, and the app's own copy if that fails.
 *
 * A desktop install wants two things that pull apart. It should see books
 * published after it was built, which means asking the site; and it should open
 * the Library on a train, which means not depending on the site. So it tries
 * the site, and falls back to what it shipped with.
 *
 * That order matters. The other way round — bundled first — is faster and
 * always works, and a desktop reader would never see a new book, which is the
 * reason the Library moved out of this repository in the first place.
 *
 * A browser build passes no fallback: it was served over a network, so it has
 * one, and there is nothing bundled to fall back to.
 */
export function withBundledFallback(
  args: {
    remote: string
    bundled: string | undefined
    fetcher?: Fetcher
    /** How long to wait for the site before using what we have. */
    timeoutMs?: number
  },
): Fetcher {
  const { remote, bundled, fetcher = fetch, timeoutMs = 6000 } = args
  if (!bundled) return fetcher

  return async (url: string): Promise<Response> => {
    const local = () => fetcher(swapBase(url, remote, bundled))

    // A URL that is not on the site is somebody's own link — a cover hosted on
    // Wikimedia, say. There is no local copy of that, so there is nothing to
    // fall back to and rewriting it would invent a path.
    if (!url.startsWith(remote)) return fetcher(url)

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      /*
        A timeout, not just a failure check. A connection that hangs rather than
        refuses — a captive portal, a dead VPN — would otherwise leave the
        Library spinning with a perfectly good copy of every book on disk.
      */
      const res = await Promise.race([
        fetcher(url),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('library site timed out')), timeoutMs)
        }),
      ])
      if (res.ok) return res
      return local()
    } catch {
      return local()
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }
}

/** Repoint a URL from one base to another, keeping everything after it. */
export function swapBase(url: string, from: string, to: string): string {
  if (!url.startsWith(from)) return url
  return `${to}${url.slice(from.length)}`.replace(/([^:]\/)\/+/g, '$1')
}
