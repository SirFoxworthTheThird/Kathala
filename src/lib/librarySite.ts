/**
 * Where the Library is served from.
 *
 * The books used to live in this repository, under `public/library/`, and every
 * path resolved against the document. They live in their own repository now —
 * SirFoxworthTheThird/Kathala-Library — published to its own site, so a new
 * book reaches readers the minute it is written instead of waiting for a
 * release of this app.
 *
 * One value serves both things the app asks for, because a world's images are
 * stored as paths beginning `library/` and the catalogue lives at
 * `library/index.json`. The site root is therefore the only address anything
 * needs to know.
 *
 * **The end-to-end suite overrides it.** A build made with `VITE_E2E=1` stages
 * the real books into `dist/library` and points this at the preview server, so
 * the suite keeps testing against the actual catalogue with no route to the
 * internet. See `scripts/stage-library.mjs`.
 */
const DEFAULT_SITE = 'https://kathala-library.netlify.app/'

/**
 * The library site, with exactly one trailing slash.
 *
 * `VITE_LIBRARY_BASE_URL` overrides it — the e2e build sets it to the document's
 * own origin, and a fork publishing its own books can point this anywhere.
 */
export function librarySiteUrl(): string {
  const configured = import.meta.env.VITE_LIBRARY_BASE_URL
  const base = typeof configured === 'string' && configured.trim() !== '' ? configured : DEFAULT_SITE
  return base.endsWith('/') ? base : `${base}/`
}

/**
 * Where the catalogue lives.
 *
 * Kept as its own function because the app asks for the catalogue far more
 * often than it asks for the site, and `${site}library/` at every call site is
 * the kind of detail that gets one occurrence wrong.
 */
export function libraryCatalogueUrl(): string {
  return `${librarySiteUrl()}library/`
}

/**
 * Where a packaged app can find the books without a network.
 *
 * The desktop build stages the catalogue and the worlds into its own files, so
 * a reader with no connection can still open the Library and import a book.
 * Artwork is not staged — pictures come from the site, as they do in a browser.
 *
 * `undefined` for a web build, which has nothing bundled and needs no fallback:
 * it was served from a network, so it has one.
 */
export function bundledLibraryBase(): string | undefined {
  return import.meta.env.VITE_LIBRARY_BUNDLED ? './' : undefined
}

/**
 * The bundled counterpart of `libraryCatalogueUrl()`.
 *
 * It has to sit at the same depth as the URL it stands in for: a fallback
 * rewrites `https://site/library/index.json` by swapping the base, so pairing
 * the catalogue URL with the *site* root would ask for `./index.json` and miss
 * the file, which lives at `./library/index.json`.
 */
export function bundledCatalogueUrl(): string | undefined {
  const base = bundledLibraryBase()
  return base === undefined ? undefined : `${base}library/`
}

/**
 * A catalogue cover, resolved to something an `<img>` can load.
 *
 * Covers come in two shapes and only one of them needs help. An absolute
 * `http(s)` URL is somebody else's host — Wikimedia, Gutenberg — and is used as
 * it stands. A path under `library/` is a file the Library serves, and since
 * the books moved out of this repository that is no longer anywhere near the
 * document: resolving it against the page asks the *app's* origin for a
 * directory that does not exist there.
 *
 * Twelve of the thirty-nine books carry a cover of the second kind, and all
 * twelve quietly lost it — quietly because `LibraryCover` hides an image that
 * fails rather than leaving a broken frame, so the card simply appeared without
 * one.
 *
 * The end-to-end suite could not catch this. It stages the books into the
 * preview server's own `dist/library`, so a relative cover resolves there and
 * works; the staging that lets the suite test against the real catalogue is
 * exactly what made it blind here. Hence the unit test, which asks the question
 * without a server in the way.
 */
export function libraryCoverUrl(cover: string): string {
  if (/^https?:\/\//i.test(cover)) return cover
  return `${librarySiteUrl()}${cover}`.replace(/([^:]\/)\/+/g, '$1')
}
