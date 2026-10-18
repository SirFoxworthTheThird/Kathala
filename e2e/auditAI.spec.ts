import { test, expect, type Page } from '@playwright/test'
import { settle } from './helpers/settle'
import { braid } from './helpers/braid'

/**
 * The AI audit (run-10 plan, Part 5): the book copied out as a prompt, an
 * assistant's reply pasted back, and every quote in it looked for in the book.
 * A finding whose quotes are there is shown in the checker with a way to each;
 * one whose quotes are not is dropped and said to be. Nothing leaves the device
 * but what the writer copies.
 */

const REPLY = JSON.stringify({
  findings: [
    {
      title: 'Ash and cinder in the same hour',
      severity: 'minor',
      quotes: ['Ash fell on the colony', 'Cinder light over the yards'],
      why: 'The ash had settled before the cinder light.',
    },
    {
      title: 'The colony was never founded',
      severity: 'serious',
      quotes: ['Ash fell on the colony', 'The colony was never founded'],
      why: 'An invented quote.',
    },
  ],
})

const checker = async (page: Page) => {
  await page.getByTitle('Continuity Checker').click()
  return page.getByRole('dialog').filter({ hasText: 'Continuity Checker' })
}

test('an audit’s reply is checked quote by quote, and what is kept is shown in the checker with a way to each quote', async ({ page, context }) => {
  test.setTimeout(150_000)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const worldId = await braid(page)
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)

  let dialog = await checker(page)
  // Before any audit, nothing from one.
  await expect(dialog.getByText('Ash and cinder in the same hour')).toHaveCount(0)
  await expect(dialog.getByText('From the AI audit', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Audit with AI' }).click()
  const audit = dialog.getByRole('region', { name: 'Audit with AI' })

  // The prompt holds the book, each chapter's era, and asks for quotes.
  await audit.getByRole('button', { name: 'Copy the audit prompt' }).click()
  await expect(audit.getByRole('button', { name: 'Copied' })).toBeVisible()
  const prompt = await page.evaluate(() => navigator.clipboard.readText())
  expect(prompt).toContain('# Chapter 1: Ash · era: The First Age')
  expect(prompt).toContain('Ash fell on the colony.')
  expect(prompt).toContain('# Chapter 3: Cinder · era: The Second Age')
  expect(prompt).toContain('at least two quotes')

  // Not JSON: said so, nothing kept.
  await audit.getByLabel('The assistant’s reply').fill('Here is what I found…')
  await audit.getByRole('button', { name: 'Check the quotes' }).click()
  await expect(audit.getByRole('alert')).toContainText('JSON')

  // A real finding and an invented one: the first kept, the second dropped and named.
  await audit.getByLabel('The assistant’s reply').fill(REPLY)
  await audit.getByRole('button', { name: 'Check the quotes' }).click()
  await expect(audit.getByRole('status')).toContainText('1 finding with every quote in the book. 1 finding dropped.')
  await expect(audit.getByRole('list', { name: 'Dropped findings' })).toContainText('The colony was never founded — “The colony was never founded” is not in the book.')
  await audit.getByRole('button', { name: 'Show them in the checker' }).click()
  // Kept on the device: the one finding, not the invented one.
  await expect.poll(() => page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as { auditFindings: { toArray: () => Promise<Array<{ title: string }>> } }
    return (await db.auditFindings.toArray()).map((f) => f.title)
  })).toEqual(['Ash and cinder in the same hour'])

  // Back in the checker: the kept finding, marked as the audit's, and the invented one nowhere.
  const row = dialog.getByText('Ash and cinder in the same hour')
  await expect(row).toBeVisible()
  await expect(dialog.getByText('From the AI audit', { exact: true })).toHaveCount(1)
  await expect(dialog.getByText('The colony was never founded')).toHaveCount(0)
  // Back in the audit with a finding in the list: the reply box keeps its own arrow keys.
  await dialog.getByRole('button', { name: 'Audit with AI' }).click()
  const box = audit.getByLabel('The assistant’s reply')
  await box.fill('line one\nline two')
  await box.press('ArrowUp')
  await box.pressSequentially('X')
  await expect(box).toHaveValue('line oneX\nline two')
  await audit.getByRole('button', { name: 'Back to the checker' }).click()

  const quotes = dialog.getByRole('list', { name: 'Quotes' })
  await expect(quotes.getByRole('button')).toHaveText(['“Ash fell on the colony” — Ch. 1', '“Cinder light over the yards” — Ch. 3'])

  // A quote goes to its scene.
  await quotes.getByRole('button', { name: /Cinder light over the yards/ }).click()
  await expect(page).toHaveURL(new RegExp(`/worlds/${worldId}/manuscript/c3`))
  await expect(page.getByRole('dialog').filter({ hasText: 'Continuity Checker' })).toHaveCount(0)

  // Rewrite the words one side rests on, and the finding has been answered.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      sceneTexts: { where: (k: string) => { equals: (v: string) => { modify: (c: { text: string }) => Promise<number> } } }
    }
    await db.sceneTexts.where('eventId').equals('e-c3').modify({ text: 'Lamp light over the yards.' })
  })
  dialog = await checker(page)
  await expect(dialog.getByText('Ash fell on the colony', { exact: false })).toHaveCount(0)
  await expect(dialog.getByText('Ash and cinder in the same hour')).toHaveCount(0)
})
