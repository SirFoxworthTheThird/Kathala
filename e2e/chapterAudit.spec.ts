import { test, expect, type Page, type Route } from '@playwright/test'
import { settle } from './helpers/settle'
import { braid } from './helpers/braid'

/**
 * Part F3: the AI audit, chapter by chapter, while writing. A chapter's panel
 * offers its audit against the book so far; it can be run with the writer's own
 * API key (decision D-2), the reply checked quote by quote as a pasted one is,
 * a finding not about the chapter dropped, and what is kept replacing only
 * what was found in that chapter before.
 *
 * The API is answered here, never reached: `page.route` stands in for it,
 * streaming as it does.
 */

const sse = (events: Array<Record<string, unknown>>) =>
  events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')

const REPLY = JSON.stringify({
  findings: [
    { title: 'Brine before the ash', severity: 'minor', quotes: ['Brine in the pipes again', 'Ash fell on the colony'], why: 'Order.' },
    // True or not, about chapters 1 and 3: not what chapter 2's audit asked.
    { title: 'Ash and cinder', severity: 'minor', quotes: ['Ash fell on the colony', 'Cinder light over the yards'], why: 'Elsewhere.' },
  ],
})

function answer(route: Route) {
  const body = sse([
    { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: REPLY } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ])
  return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body })
}

const findings = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { auditFindings: { toArray: () => Promise<Array<{ title: string }>> } }
  return (await db.auditFindings.toArray()).map((f) => f.title).sort()
})

async function openChapterAudit(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript/c2`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('region', { name: 'Chapter 2' }).getByRole('button', { name: 'Audit this chapter with AI' }).click()
  const audit = page.getByRole('dialog').getByRole('region', { name: 'Audit chapter 2 with AI' })
  await expect(audit.getByRole('heading', { name: 'Chapter 2: Brine, against the book so far' })).toBeVisible()
  return audit
}

test('a chapter’s audit, run with the writer’s key, keeps what is about the chapter and leaves the rest of the book’s findings', async ({ page, context }) => {
  test.setTimeout(150_000)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const worldId = await braid(page)
  // An earlier whole-book audit found something in chapter 3.
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as { auditFindings: { add: (v: unknown) => Promise<unknown> } }
    await db.auditFindings.add({ id: 'old', worldId: id, title: 'Cinder, earlier', severity: 'minor', why: '', quotes: [{ text: 'Cinder light', eventId: 'e-c3' }, { text: 'Cinder light', eventId: 'e-c3' }], createdAt: 1 })
  }, worldId)

  const audit = await openChapterAudit(page, worldId)
  // The book so far: chapters 1 and 2, not 3.
  await audit.getByRole('button', { name: 'Copy the audit prompt' }).click()
  const prompt = await page.evaluate(() => navigator.clipboard.readText())
  expect(prompt).toContain('You are auditing chapter 2 of a novel')
  expect(prompt).toContain('Ash fell on the colony.')
  expect(prompt).toContain('Brine in the pipes again.')
  expect(prompt).not.toContain('Cinder light over the yards.')

  // Run here: the request carries the key and the chapter's prompt, and nothing else is reached.
  const sent: Array<{ auth: string; body: { messages: Array<{ content: string }> } }> = []
  await page.route('https://api.anthropic.com/**', (route) => {
    const h = route.request().headers()
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } })
    sent.push({ auth: `${h['x-api-key'] ?? ''} ${h.authorization ?? ''}`, body: route.request().postDataJSON() })
    return answer(route)
  })
  await audit.getByLabel('Anthropic API key').fill('sk-ant-e2e')
  await audit.getByRole('button', { name: 'Run the audit' }).click()
  await expect(audit.getByText('1 finding with every quote in the book. 1 finding dropped.')).toBeVisible({ timeout: 30_000 })
  await expect(audit.getByRole('list', { name: 'Dropped findings' })).toContainText('Ash and cinder — None of its quotes is from chapter 2.')
  expect(sent).toHaveLength(1)
  expect(sent[0].auth).toContain('sk-ant-e2e')
  expect(sent[0].body.messages[0].content).toContain('You are auditing chapter 2 of a novel')

  await audit.getByRole('button', { name: 'Show them in the checker' }).click()
  // Chapter 3's earlier finding stands beside chapter 2's new one.
  await expect.poll(() => findings(page)).toEqual(['Brine before the ash', 'Cinder, earlier'])
})

test('the key is kept for this tab only when asked, never in localStorage, and can be forgotten', async ({ page, context }) => {
  test.setTimeout(150_000)
  const worldId = await braid(page)
  let audit = await openChapterAudit(page, worldId)
  // In a browser there is only one way to keep it: for this tab.
  await expect(audit.getByLabel('Keep the key until this tab is closed')).toBeVisible()
  await audit.getByLabel('Anthropic API key').fill('sk-ant-kept')
  await page.route('https://api.anthropic.com/**', (route) => route.fulfill({ status: 401, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid' } }) }))
  // Not asked: gone after a reload.
  await audit.getByRole('button', { name: 'Run the audit' }).click()
  await expect(audit.getByRole('alert')).toHaveText('The key was not accepted. Check it, or copy the prompt instead.')
  await page.reload({ waitUntil: 'load' })
  audit = await openChapterAudit(page, worldId)
  await expect(audit.getByLabel('Anthropic API key')).toHaveValue('')

  // Asked: there after a reload of this tab — and nowhere that outlives it.
  await audit.getByLabel('Anthropic API key').fill('sk-ant-kept')
  await audit.getByLabel('Keep the key until this tab is closed').check()
  await audit.getByRole('button', { name: 'Run the audit' }).click()
  await expect(audit.getByRole('alert')).toBeVisible()
  await page.reload({ waitUntil: 'load' })
  audit = await openChapterAudit(page, worldId)
  await expect(audit.getByLabel('Anthropic API key')).toHaveValue('sk-ant-kept')
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain('sk-ant-kept')
  // Another tab of the same browser does not have it.
  const other = await context.newPage()
  const elsewhere = await openChapterAudit(other, worldId)
  await expect(elsewhere.getByLabel('Anthropic API key')).toHaveValue('')
  await other.close()

  // Forgotten: the field empties, and a reload brings nothing back.
  await audit.getByRole('button', { name: 'Forget the key' }).click()
  await expect(audit.getByLabel('Anthropic API key')).toHaveValue('')
  await page.reload({ waitUntil: 'load' })
  audit = await openChapterAudit(page, worldId)
  await expect(audit.getByLabel('Anthropic API key')).toHaveValue('')
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }))).not.toContain('sk-ant-kept')
})
