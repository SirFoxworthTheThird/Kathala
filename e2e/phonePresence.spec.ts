import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * On the phone (writer run 8): Edmund is on the phone to Nell through a scene.
 * On stage would put him at her place; mentioned would say he never appears.
 */

async function book(page: Page, opts: { reading?: boolean } = {}): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Slack Water')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, reading }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.locationMarkers.add({ id: 'studio', worldId: id, mapLayerId: null, name: 'The Studio', description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'building', color: null, createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The Archive', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    for (const [n, title, text, remote] of [[1, 'The call', 'The line hissed.', reading ? ['edmund'] : []], [2, 'After', 'She put the phone down.', []]] as const) {
      await db.events.add({
        id: `e${n}`, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: n,
        tags: [], locationMarkerId: 'studio', involvedCharacterIds: ['nell'], mentionedCharacterIds: [], remoteCharacterIds: [...remote], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${n}`, worldId: id, eventId: `e${n}`, text, wordCount: 3, updatedAt: now })
    }
    for (const [cid, name] of [['nell', 'Nell Garrity'], ['edmund', 'Edmund Varley'], ['kit', 'Kit Fenwick']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    if (reading) await db.worlds.update(id, { readingMode: true })
  }, { id: worldId, reading: !!opts.reading })
  return worldId
}

const scene = (page: Page, id: string) => page.evaluate(async (eid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { get: (id: string) => Promise<{ involvedCharacterIds: string[]; remoteCharacterIds?: string[] }> }
    characterSnapshots: { toArray: () => Promise<Array<{ characterId: string; eventId: string; currentLocationMarkerId: string | null }>> }
  }
  const e = await db.events.get(eid)
  const placed = (await db.characterSnapshots.toArray()).filter((s) => s.eventId === eid && s.currentLocationMarkerId === 'studio').map((s) => s.characterId).sort()
  return { cast: e.involvedCharacterIds, remote: e.remoteCharacterIds ?? [], placed }
}, id)

test.describe('somebody on the phone', () => {
  test.describe.configure({ timeout: 150_000 })

  test('`:phone` on the Characters line puts them in the scene from elsewhere, and not at its place', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    const line = page.locator('.cm-line', { hasText: 'Characters: @@Nell Garrity' }).first()
    await expect(line).toBeVisible({ timeout: 20_000 })

    await line.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @@Edmund', { delay: 30 })
    await page.waitForTimeout(400)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Backspace')
    await page.keyboard.type(':phone')
    await page.locator('.cm-line', { hasText: 'The line hissed.' }).first().click()

    // Nell is in the room and recorded there; Edmund is in the scene, and nowhere near the studio.
    await expect.poll(() => scene(page, 'e1'), { timeout: 15_000 }).toEqual({ cast: ['nell'], remote: ['edmund'], placed: ['nell'] })
    await expect(page.locator('.cm-line', { hasText: 'Characters: @@Nell Garrity @@Edmund Varley:phone' })).toHaveCount(1)
  })

  test('the scene panel takes it, and Cast Balance and the Appearances tab say it apart', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The call', exact: true }).click()
    const offer = page.getByRole('button', { name: /On the phone/ }).first()
    if (await offer.count()) await offer.click()
    await page.getByRole('button', { name: '+ Someone on the phone…', exact: true }).first().click()
    await page.getByRole('option', { name: 'Edmund Varley', exact: true }).click()
    await expect.poll(() => scene(page, 'e1')).toMatchObject({ cast: ['nell'], remote: ['edmund'] })
    await expect(page.getByRole('button', { name: 'Take Edmund Varley off the phone', exact: true })).toBeVisible()

    // Cast Balance: never on stage, and said where he is instead.
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByText('never on-stage · on the phone in 1 scene', { exact: true })).toBeVisible({ timeout: 20_000 })
    // Paired: Kit, in nothing at all.
    await expect(page.getByText('never appears', { exact: true }).first()).toBeVisible()

    await page.goto(`/#/worlds/${worldId}/characters/edmund`)
    await settle(page)
    await expect(page.getByRole('tab', { name: 'Appearances 0 · 1 on the phone', exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test('a reader meets a voice on the phone, as they meet somebody on stage', async ({ page }) => {
    const worldId = await book(page, { reading: true })
    await page.evaluate(() => {
      const raw = localStorage.getItem('kathala-ui')
      const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      st.state.activeEventId = 'e2'
      st.state.eventByWorld = { ...(st.state.eventByWorld ?? {}) }
      localStorage.setItem('kathala-ui', JSON.stringify(st))
    })
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    await expect(main.getByText('Nell Garrity', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(main.getByText('Edmund Varley', { exact: true }).first()).toBeVisible()
    // Paired: Kit, met nowhere, is not listed.
    await expect(main.getByText('Kit Fenwick', { exact: true })).toHaveCount(0)
  })
})
