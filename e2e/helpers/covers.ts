import type { Page } from '@playwright/test'

/**
 * Every request for a Library book's cover, and stand-in bytes to answer it.
 *
 * A cover is one of two kinds. Some are remote URLs — Wikimedia, a poster
 * site. The rest are paths into the Library's own art, `library/<book>/art/…`,
 * which the app resolves against the Library site (`libraryCoverUrl`). The
 * end-to-end build stages only the catalogue and the worlds, not the art
 * folders, so a path of the second kind reaches the preview server and finds
 * nothing.
 *
 * Specs matched the first kind only, and that held while Dracula — the card
 * they all look at — linked Wikimedia. The Library moved Dracula to its own art
 * and two specs went red, while a third, which refuses covers to check that a
 * card copes, went on passing because the request now failed by itself.
 * Stubbing both kinds keeps these specs about our rendering, and makes a
 * refusal a refusal.
 */
export const COVERS = /upload\.wikimedia\.org|commons\.wikimedia\.org|static\.posters\.cz|\/library\/[^/]+\/art\//

export const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">
  <rect width="400" height="600" fill="#6d5f8f"/>
</svg>`

/** Serve stand-in bytes for every cover, wherever it lives. */
export async function serveCovers(page: Page) {
  await page.route(COVERS, (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PLACEHOLDER }))
}

/** Refuse every cover, as a server that has gone away would. */
export async function refuseCovers(page: Page) {
  await page.route(COVERS, (route) => route.abort())
}
