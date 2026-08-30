import { formatBytes } from './library'

/**
 * Taking a copy of a linked picture, so a world stops depending on somebody
 * else's server.
 *
 * A `BlobEntry` holds *either* bytes or a URL, and everything that shows a
 * picture reads it through the same id — so swapping one for the other is a
 * single field on a single record and no caller has to know. That is what makes
 * this worth offering at all.
 *
 * **It cannot promise to work.** A linked picture is fetched by the browser as
 * an `<img>`, which needs no permission; copying its bytes needs `fetch`, which
 * needs the site to allow cross-origin reads. Plenty do not, and no amount of
 * trying changes that. So the whole shape of this is *partial by design*: it
 * reports what it took and what it could not, per site, and a version that
 * failed quietly would be worse than not having it — a writer would think their
 * world was portable when it was not.
 *
 * **And it is never automatic.** Linking is why a library download is small:
 * all thirty shipped worlds link rather than bundle, and *Alice in Wonderland*
 * is a 347,498-byte `.pwk` against 28,505,956 bytes of pictures. Copying is the
 * choice of whoever is about to get on a plane.
 */

export interface LocaliseResult {
  saved: number
  failed: Array<{ host: string; reason: string }>
  bytes: number
}

/**
 * The host a linked picture comes from, for grouping failures by site.
 *
 * Two of the shipped worlds — Alice and Peter Pan — link their pictures by
 * *relative* path (`library/alice-in-wonderland/art/tenniel/tenniel-01.gif`),
 * served from wherever the app itself is, and `new URL` throws on those. Taking
 * the first forty characters instead would count eighty-four pictures as a
 * handful of different "sites", so a relative path is resolved against the page
 * first and only then given up on.
 */
export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    try {
      // `file://` has no host, which is why this is guarded rather than trusted:
      // under Electron the fallback below is the answer.
      const host = typeof location === 'undefined' ? '' : new URL(url, location.href).host
      if (host) return host
    } catch { /* not a path either — fall through */ }
    return url.slice(0, 40)
  }
}

/**
 * What to say before starting: how many pictures are linked and where from.
 *
 * The count alone is not enough to decide with — "412 pictures" says nothing
 * about whether this is a ten-second job or a hundred megabytes — but the size
 * is genuinely unknown until each one is fetched, and guessing at it would be
 * inventing a number. So this says what is known: how many, and from how many
 * different places.
 *
 * It does not say "on the web", because for a library world it would not be
 * true — those pictures are served from the same place the app is.
 */
export function describeLinked(urls: readonly string[]): string {
  if (urls.length === 0) return 'Every picture in this world is already saved on this device.'
  const hosts = new Set(urls.map(hostOf)).size
  const sites = `${hosts} site${hosts === 1 ? '' : 's'}`
  return urls.length === 1
    ? `1 picture in this world is a link rather than a file kept here, fetched from ${sites} each time it is shown.`
    : `${urls.length} pictures in this world are links rather than files kept here, fetched from ${sites} each time they are shown.`
}

/** What to say afterwards, including the part that did not work. */
export function describeLocaliseResult(result: LocaliseResult): string {
  const { saved, failed, bytes } = result
  if (saved === 0 && failed.length === 0) return 'There was nothing to save.'

  const took = saved > 0
    ? `Saved ${saved} picture${saved === 1 ? '' : 's'} to this device (${formatBytes(bytes)}).`
    : 'No pictures could be saved.'
  if (failed.length === 0) return took

  /*
    Grouped by site, because that is the shape of the cause: a site either
    allows its pictures to be copied or it does not, so one line per site is the
    whole explanation, where one line per picture would be the same sentence
    forty times.
  */
  const byHost = new Map<string, number>()
  for (const f of failed) byHost.set(f.host, (byHost.get(f.host) ?? 0) + 1)
  const worst = [...byHost.entries()].sort((a, b) => b[1] - a[1])
  const named = worst.slice(0, 3).map(([host, n]) => `${host} (${n})`).join(', ')
  const rest = worst.length > 3 ? `, and ${worst.length - 3} other site${worst.length - 3 === 1 ? '' : 's'}` : ''
  return `${took} ${failed.length} could not be copied because the site does not allow it: ${named}${rest}. Those stay as links and still appear when you are online.`
}
