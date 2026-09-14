/**
 * Where the Library is served from.
 *
 * The books used to live in this repository, under `public/library/`, and every
 * path resolved against the document. They live in their own repository now —
 * SirFoxworthTheThird/PlotWeave-Library — published to its own site, so a new
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
 * internet. See `scripts/stage-e2e-library.mjs`.
 */
const DEFAULT_SITE = 'https://plotweave-library.netlify.app/'

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
