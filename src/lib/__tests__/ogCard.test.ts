import { describe, it, expect } from 'vitest'

/**
 * The social preview card is the dashboard screenshot the guide already keeps.
 *
 * `og:image` has to be served from the site, so it cannot point into `docs/`.
 * The card is therefore a copy of `docs/images/03-dashboard.png`, and a copy
 * drifts: the logo change refreshed all 43 screenshots under `docs/images/` and
 * left this one behind, because it does not live there. For a while every link
 * shared anywhere previewed the app under its previous brand — the most visible
 * image in the project, showing the one thing that had just been replaced.
 *
 * Asserted as "these two files are the same bytes" rather than by inspecting
 * either. Nothing here can tell whether a screenshot depicts the current logo,
 * but it can insist the card is whatever the guide's dashboard is; refreshing
 * the guide then refreshes the card, and forgetting fails here instead of
 * shipping.
 *
 * If the card should ever become its own composition rather than a copy of a
 * screenshot, delete this test with that change — the coupling is the point,
 * not the file.
 */

/*
  `?raw` rather than `?url`: under Vitest a `?url` import is just the file's
  path, so comparing those compares names and would pass on two different
  images. Reading the bytes as text is lossy for a PNG, but equality survives
  it — the same bytes decode to the same string, and these two files are either
  copies of each other or they are not.
*/
const card = import.meta.glob('../../../public/og-card.png', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

const dashboard = import.meta.glob('../../../docs/images/03-dashboard.png', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

describe('the social preview card', () => {
  it('has both files to compare', () => {
    // Without this the rule below passes on two empty globs.
    expect(Object.keys(card)).toHaveLength(1)
    expect(Object.keys(dashboard)).toHaveLength(1)
  })

  it('is the same image the guide shows for the dashboard', () => {
    const a = Object.values(card)[0]
    const b = Object.values(dashboard)[0]
    expect(a.length, 'the card and the dashboard screenshot differ in size').toBe(b.length)
    expect(a === b, 'refresh docs/images/03-dashboard.png and copy it to public/og-card.png').toBe(true)
  })
})
