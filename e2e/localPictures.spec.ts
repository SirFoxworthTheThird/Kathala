import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * Taking a copy of a linked picture, so a world stops depending on somebody
 * else's server.
 *
 * PlotWeave's first promise is that a story never leaves the device, and
 * pictures are the documented exception: a picture is either bytes in this
 * browser or a link to one elsewhere. That is why *Alice in Wonderland*
 * downloads as a 347,498-byte `.pwk` when its pictures are 28 MB, and also why
 * a downloaded book's maps do not draw on a train, and why a `.pwk` kept as a
 * backup slowly stops matching what it looked like as links rot.
 *
 * **The failure path is the point of this spec.** A linked picture is drawn by
 * the browser as an `<img>`, which needs no permission; copying its bytes needs
 * `fetch`, which needs the site to allow cross-origin reads. Plenty do not, and
 * a version of this feature that failed quietly would leave a writer believing
 * their world was portable when it was not. So both halves are driven: one
 * picture that can be copied, one that cannot, in the same world.
 *
 * The two are on *different* origins from the app, and that is not incidental:
 * a first version put both on the app's own origin, where CORS does not apply
 * at all, and cheerfully copied the picture that was supposed to be refused.
 * The test was wrong and the code was right, which is the more embarrassing way
 * round. They are intercepted rather than really fetched, so this does not
 * reach out to Wikimedia — a test of *this* feature that failed on an
 * aeroplane would be a poor joke.
 */

test.describe('saving linked pictures to this device', () => {
  test.describe.configure({ timeout: 240_000 })

  test('copies what it can, and says which sites refused', async ({ page }) => {
    /*
      One route answers with an image; the other refuses to answer at all.

      `abort()` rather than a response without CORS headers, and the reason is
      worth recording: Playwright's `route.fulfill()` delivers its response to
      the page *without* the browser's cross-origin check, so a fulfilled
      response missing `access-control-allow-origin` is copied happily and the
      test passes while proving nothing — measured, twice, before this comment
      existed. An abort is faithful instead of convenient: a blocked
      cross-origin read and a refused connection reach the app identically, as
      `fetch` rejecting with a `TypeError`, which is the branch under test.
    */
    await page.route('https://allowed.test/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: Buffer.alloc(4096, 7),
      }))
    await page.route('https://refused.test/**', (route) => route.abort('failed'))

    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Pictures')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      await db.blobs.add({ id: 'ok', worldId: id, mimeType: 'image/png', url: 'https://allowed.test/allowed.png', createdAt: 0 })
      await db.blobs.add({ id: 'no', worldId: id, mimeType: 'image/png', url: 'https://refused.test/refused.png', createdAt: 0 })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await settle(page)

    // It says what is linked before doing anything, which is what a writer
    // decides on.
    /*
      Scoped to the section, not the page. The settings screen carries several
      `role="status"` elements — Travel Modes has one reading "Needs a name and
      a speed" — and a page-wide lookup found that one instead, which failed in
      a way that looked like this feature was broken.
    */
    const section = page.locator('#settings-pictures')
    await expect(section.getByText(/2 pictures in this world are links/)).toBeVisible({ timeout: 20_000 })

    await section.getByRole('button', { name: 'Save pictures to this device' }).click()

    const report = section.getByRole('status')
    await expect(report).toBeVisible({ timeout: 60_000 })
    const text = await report.innerText()
    expect(text, `report was: ${text}`).toContain('Saved 1 picture')
    expect(text, 'the refusal must be named, not swallowed').toContain('1 could not be copied')
    expect(text, 'and named by site').toContain('refused.test')
    expect(text).toContain('still appear when you are online')

    // And the store agrees with the report: one is bytes now, one is still a
    // link. Without this the sentence above could be a well-written fiction.
    const state = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { blobs: { get: (id: string) => Promise<{ url?: string; data?: unknown } | undefined> } }
      const ok = await db.blobs.get('ok')
      const no = await db.blobs.get('no')
      return { okHasData: !!ok?.data, okUrl: ok?.url ?? null, noUrl: no?.url ?? null }
    })
    expect(state.okHasData, 'the copied picture should hold its bytes').toBe(true)
    expect(state.okUrl, 'and should no longer be a link').toBeNull()
    expect(state.noUrl, 'a refusal must not cost the picture').toContain('refused.png')

    // Run again and only the one that cannot be copied is left to try.
    await expect(section.getByText(/1 picture in this world is a link/)).toBeVisible({ timeout: 20_000 })
  })

  test('says there is nothing to do when every picture is already here', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('No Links')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await settle(page)
    const section = page.locator('#settings-pictures')
    await expect(section.getByText('Every picture in this world is already saved on this device.'))
      .toBeVisible({ timeout: 20_000 })
    // Nothing to press, rather than a button that would do nothing.
    await expect(section.getByRole('button', { name: 'Save pictures to this device' })).toHaveCount(0)
  })
})
