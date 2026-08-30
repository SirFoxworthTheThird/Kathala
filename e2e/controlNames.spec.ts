import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * Every visible control has a name a screen reader can read.
 *
 * The Highbarrow writer-journey review filed this as a list — the two Elapsed
 * Time inputs, the travel-mode speed, "several scene row actions and map tool
 * buttons" — and asked for an automated check rather than another list. A list
 * goes stale the moment someone adds a control; the property does not.
 *
 * A **placeholder deliberately does not count**. It is a last-resort name
 * source in HTML-AAM, it disappears the moment the field has a value, and it
 * is exactly what made the Elapsed Time inputs look named while announcing
 * themselves as "0" and "auto".
 *
 * Each screen asserts a *floor* on how many controls it found as well as zero
 * unnamed ones. Without that a routing change that renders nothing at all
 * would turn this suite green — the vacuous pass this repo keeps catching.
 */

interface Unnamed { tag: string; type: string; placeholder: string; cls: string; near: string }

async function unnamedControls(page: Page): Promise<{ total: number; bad: Unnamed[] }> {
  return page.evaluate(() => {
    const bad: Unnamed[] = []
    let total = 0
    const els = Array.from(
      document.querySelectorAll('button, input, select, textarea, a[href], [role="button"], [role="checkbox"]'),
    ) as HTMLElement[]
    for (const el of els) {
      if (!el.checkVisibility()) continue
      const input = el as HTMLInputElement
      if (input.type === 'hidden') continue
      total++
      const labelled = input.labels && input.labels.length > 0
        ? (input.labels[0].textContent ?? '').trim()
        : ''
      const describedBy = el.getAttribute('aria-labelledby')
      const fromIds = describedBy
        ? describedBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
        : ''
      const img = el.querySelector('img[alt]')
      const name = (
        el.getAttribute('aria-label')
        ?? (fromIds || null)
        ?? (labelled || null)
        ?? (el.getAttribute('title') || null)
        ?? ((el.textContent ?? '').trim() || null)
        ?? (img?.getAttribute('alt') || null)
        ?? ''
      ).trim()
      if (name) continue
      bad.push({
        tag: el.tagName,
        type: input.type ?? '',
        placeholder: input.placeholder ?? '',
        cls: (el.className ?? '').toString().slice(0, 70),
        near: (el.parentElement?.textContent ?? '').trim().slice(0, 50),
      })
    }
    return { total, bad }
  })
}

async function seedWorld(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Named')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({
      id: 'tl1', worldId: id, name: 'Main', description: '',
      color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now,
    })
    await db.chapters.add({
      id: 'ch1', worldId: id, timelineId: 'tl1', number: 1, title: 'Chapter 1',
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl1', title: 'The wreck',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: 2, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: 3,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
    await db.characters.add({
      id: 'ch-1', worldId: id, name: 'Barnaby', aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null,
      createdAt: now, updatedAt: now,
    })
    await db.lorePages.add({
      id: 'lp1', worldId: id, categoryId: null, title: 'The Compact', body: '',
      tags: [], visibility: 'always', createdAt: now, updatedAt: now,
    })
  }, worldId)
  await page.waitForTimeout(500)
  return worldId
}

function report(screen: string, bad: Unnamed[]) {
  return `${screen}: ${bad.length} unnamed control(s)\n` +
    bad.map((b) => `  <${b.tag}> type=${b.type} placeholder="${b.placeholder}" near="${b.near}" class="${b.cls}"`).join('\n')
}

test.describe('Every visible control has an accessible name', () => {
  test.describe.configure({ timeout: 180_000 })

  test('across the screens a writer works in', async ({ page }) => {
    const worldId = await seedWorld(page)

    // `floor` is what makes a zero meaningful: the screen has to have rendered
    // this many controls before "none of them is unnamed" says anything.
    const screens: Array<{ path: string; floor: number }> = [
      { path: `/#/worlds/${worldId}`, floor: 10 },
      { path: `/#/worlds/${worldId}/timeline`, floor: 8 },
      { path: `/#/worlds/${worldId}/timeline/ch1`, floor: 8 },
      { path: `/#/worlds/${worldId}/characters`, floor: 5 },
      { path: `/#/worlds/${worldId}/lore`, floor: 5 },
      { path: `/#/worlds/${worldId}/settings`, floor: 10 },
      { path: `/#/worlds/${worldId}/calendar`, floor: 5 },
      { path: '/', floor: 3 },
    ]

    const failures: string[] = []
    for (const { path, floor } of screens) {
      await page.goto(path)
      await settle(page)
      const { total, bad } = await unnamedControls(page)
      expect(total, `${path} should render controls at all`).toBeGreaterThanOrEqual(floor)
      if (bad.length) failures.push(report(path, bad))
    }
    expect(failures, failures.join('\n\n')).toEqual([])
  })

  test('and in the expanded scene editor, where Elapsed Time lives', async ({ page }) => {
    const worldId = await seedWorld(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`)
    await page.getByRole('button', { name: 'Expand “The wreck”' }).click({ timeout: 30_000 })
    await page.waitForTimeout(1000)

    // Presence: the section this was filed against is actually on screen.
    await expect(page.getByText('Elapsed Time', { exact: true })).toBeVisible()
    const spinners = page.locator('input[type="number"]')
    await expect(spinners).toHaveCount(2)

    const readOnly = await unnamedControls(page)
    expect(readOnly.total, 'the expanded editor should render controls').toBeGreaterThanOrEqual(15)
    expect(readOnly.bad, report('expanded scene editor', readOnly.bad)).toEqual([])

    // Edit mode swaps the description for a textarea whose only label is the
    // word "Description" in an unassociated sibling span — so it is not on
    // screen at all until this click, and a check that stopped above would
    // have reported the editor clean while missing the field a writer types
    // the scene into. Found by a mutation surviving.
    await page.getByRole('button', { name: 'Edit title & description' }).click()

    // Presence, both fields: the title swaps from a disclosure button to an
    // input, and the description from text to a textarea. Neither had a name.
    await expect(page.getByRole('textbox', { name: 'Scene title' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Scene description' })).toBeVisible()

    const editing = await unnamedControls(page)
    // An absolute floor, not `>= readOnly.total`: edit mode legitimately draws
    // fewer controls, because the chips that offer the unused sections are
    // replaced by the sections themselves.
    expect(editing.total, 'edit mode should render controls').toBeGreaterThanOrEqual(15)
    expect(editing.bad, report('scene editor, editing', editing.bad)).toEqual([])
  })
})
