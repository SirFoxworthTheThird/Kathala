import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * The spoiler pass in Read (run-10 plan, Part 3): the book read from the start
 * with what the reader has been told so far beside it, by era, and what is
 * still to come; the words of facts still to come underlined in the text.
 * The Cold Choir braids three eras, and its fact "Ilse Varga flew Deck Nine
 * down to Ninefold" is told in Ch. 19 (The Mercy); "Opener" gives it away.
 */
const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/cold-choir.pwk')
const TITLE = 'Ilse Varga flew Deck Nine down to Ninefold'

async function coldChoir(page: Page): Promise<string> {
  await resetDB(page)
  await page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]').setInputFiles(FIXTURE)
  await expect(page.getByRole('heading', { name: 'The Cold Choir' })).toBeVisible({ timeout: 60_000 })
  await expect(page).toHaveURL(/#\/worlds\/[^/]+/)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.evaluate(async (title) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, {
      filter: (f: (v: { title: string }) => boolean) => { first: () => Promise<{ id: string } | undefined> }
      update: (id: string, v: unknown) => Promise<unknown>
    }>
    const fact = await db.knowledgeFacts.filter((f) => f.title === title).first()
    await db.knowledgeFacts.update(fact!.id, { spoilerWords: ['Opener'] })
  }, TITLE)
  return worldId
}

async function readAll(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('tablist', { name: 'Timelines' }).getByRole('tab', { name: /All timelines/ }).click()
  await expect(page.getByRole('main').locator('[data-chapter-number="20"]')).toBeAttached({ timeout: 30_000 })
}

test('the spoiler pass marks the words of facts still to come, and lists what is told so far by era', async ({ page }) => {
  test.setTimeout(150_000)
  const worldId = await coldChoir(page)
  await readAll(page, worldId)
  const main = page.getByRole('main')
  const ch11 = main.locator('[data-chapter-number="11"]')
  const ch20 = main.locator('[data-chapter-number="20"]')

  // Off: the book as it reads, and the card is who is in the scene.
  await expect(ch11).toContainText('Opener')
  await expect(main.locator('mark[data-spoiler]')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'In this scene' })).toBeVisible()

  const button = page.getByRole('button', { name: 'Spoiler pass', exact: true })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')

  // Ch. 11, The Compact, comes before Ch. 19 tells it: marked, saying where it is told.
  const mark = ch11.locator('mark[data-spoiler]').filter({ hasText: /^Opener$/i }).first()
  await expect(mark).toBeVisible()
  await expect(mark).toHaveAttribute('title', `Told in Ch. 19: ${TITLE}`)
  // Ch. 20 says it too ("THE OPENER KEPT FAITH"), after the reader has been told: not marked.
  await expect(ch20).toContainText(/\bopener\b/i)
  await expect(ch20.locator('mark[data-spoiler]')).toHaveCount(0)

  // At the start of the book, it is still to come.
  const card = page.getByRole('complementary', { name: 'Spoiler pass' })
  await main.locator('[data-chapter-number="1"]').evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await expect(card).toContainText('Ch. 1 ·')
  await expect(card.getByRole('region', { name: 'Still to come' })).toContainText(TITLE)
  await expect(card.getByRole('region', { name: 'Told so far' })).not.toContainText(TITLE)

  // Past Ch. 19, it has been told, under its era.
  await ch20.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await expect(card).toContainText('Ch. 20 ·')
  const told = card.getByRole('region', { name: 'Told so far' })
  await expect(told).toContainText(TITLE)
  await expect(told.getByRole('heading', { name: 'The Mercy', exact: true })).toBeVisible()
  await expect(card.getByRole('region', { name: 'Still to come' })).not.toContainText(TITLE)

  // Off again: no marks, and the card is the cast again.
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await expect(main.locator('mark[data-spoiler]')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'In this scene' })).toBeVisible()
})

test('a reader in reading mode is not offered the spoiler pass', async ({ page }) => {
  test.setTimeout(150_000)
  const worldId = await coldChoir(page)
  await readAll(page, worldId)
  // The writer is offered it on Read…
  await expect(page.getByRole('button', { name: 'Spoiler pass', exact: true })).toBeVisible()
  // …a reader, on the same book, is not: it would list every fact the book has yet to tell them.
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { update: (id: string, v: unknown) => Promise<unknown> }>
    await db.worlds.update(id, { readingMode: true })
  }, worldId)
  await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('main').locator('[data-chapter-number="1"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Spoiler pass', exact: true })).toHaveCount(0)
  await expect(page.getByRole('main').locator('mark[data-spoiler]')).toHaveCount(0)
})
