import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'fs/promises'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook } from './helpers/library'
import { readPdf, printProblems } from '../src/lib/pdfCheck'
import { TRIM_SIZES } from '../src/lib/pdfLayout'
import { chapterHeadingLines } from '../src/lib/chapterHeading'

/*
  The PDF export (issue #701), from the Export dialog, in the real app: a
  reading copy, a print interior and a submission, each downloaded and read
  back from its own bytes (`pdfCheck`), as a printer would. Then three Library
  books as print interiors, timed, with their widows, orphans and stranded
  headings counted, through the `__pwpdf` seam, since the file cannot say them.
*/

const MANUSCRIPT = [
  '# The Salt Ledger',
  '',
  '## Chapter 1: The Weighing House',
  '',
  'The weighing house opened before the tide turned, and _nobody_ was early.',
  '',
  '## Chapter 2: The Quay',
  '',
  'The first cart came up the quay at six.',
].join('\n')

async function openPdfExport(page: Page) {
  await page.getByRole('main').getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export manuscript' })
  await dialog.getByRole('button', { name: 'PDF', exact: true }).click()
  return dialog
}

async function download(page: Page, dialog: ReturnType<Page['getByRole']>) {
  const pending = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download .pdf' }).click()
  const file = await pending
  return { name: file.suggestedFilename(), report: await readPdf(new Uint8Array(await readFile((await file.path())!))) }
}

const textOf = (r: Awaited<ReturnType<typeof readPdf>>, page: number) => r.pages[page].lines.map((l) => l.text)

test.describe('PDF export', () => {
  test('a reading copy, a print interior and a submission, each read back; the choices kept for the next export', async ({ page }) => {
    test.setTimeout(180_000)
    await resetDB(page)
    await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
    await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
    await page.getByRole('button', { name: /^Import/ }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
    await expect(page.getByRole('main').getByText('The first cart came up the quay at six.')).toBeVisible()

    let dialog = await openPdfExport(page)
    // A reading copy is the first, on A4: a title page, then the chapters.
    await expect(dialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Reading copy' })).toHaveAttribute('aria-pressed', 'true')
    await dialog.getByRole('textbox', { name: 'Author (optional)' }).fill('Ines Varga')
    const reading = await download(page, dialog)
    expect(reading.name).toBe('the-salt-ledger.pdf')
    expect(reading.report.pages[0].width).toBeCloseTo(595.28, 1)
    expect(textOf(reading.report, 0)).toEqual(['The Salt Ledger', 'Ines Varga'])
    expect(reading.report.pages.flatMap((p) => p.lines.map((l) => l.text))).toContain('The weighing house opened before the tide turned, and nobody was early.')
    await expect(dialog.getByRole('status')).toHaveText(/^Saved the PDF: \d+ pages\.$/)

    // A print interior on 5 × 8, with its front and back matter.
    await dialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Print interior' }).click()
    await dialog.getByRole('button', { name: /^Trim size/ }).click()
    await page.getByRole('option', { name: '5 × 8 in', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Copyright page (optional)' }).fill('© 2026 Ines Varga')
    await dialog.getByRole('textbox', { name: 'Dedication (optional)' }).fill('For the harbourmaster.')
    await dialog.getByRole('textbox', { name: 'About the Author page (optional)' }).fill('Ines Varga lives by a harbour.')
    const print = await download(page, dialog)
    const trim = TRIM_SIZES.find((t) => t.id === '5x8')!
    const headings = [chapterHeadingLines('ch-title', 1, 'The Weighing House')[0], chapterHeadingLines('ch-title', 2, 'The Quay')[0]]
    expect(printProblems(print.report, { width: trim.width, height: trim.height, headings })).toEqual([])
    expect(print.report.fonts.length).toBeGreaterThan(0)
    expect(print.report.fonts.every((f) => f.embedded && f.subtype !== 'Type3')).toBe(true)
    expect(textOf(print.report, 1)).toEqual(['© 2026 Ines Varga'])
    expect(textOf(print.report, 2)).toEqual(['For the harbourmaster.'])
    expect(print.report.pages.flatMap((p) => p.lines.map((l) => l.text))).toContain('About the Author')

    // A submission: the byline's name needed, then the Word file's layout.
    await dialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Submission' }).click()
    await dialog.getByRole('textbox', { name: 'Name on the byline' }).fill('')
    await expect(dialog.getByRole('button', { name: 'Download .pdf' })).toBeDisabled()
    await dialog.getByRole('textbox', { name: 'Name on the byline' }).fill('Ines Varga')
    await dialog.getByRole('textbox', { name: 'Contact details' }).fill('12 Quay Lane')
    const sub = await download(page, dialog)
    expect(sub.report.pages[0].width).toBe(612)
    expect(textOf(sub.report, 0)).toEqual(expect.arrayContaining(['Ines Varga', '12 Quay Lane', 'The Salt Ledger', 'by Ines Varga']))
    expect(textOf(sub.report, 1)).toContain('Varga / THE SALT LEDGER / 2')

    // Closed and opened again: the PDF's layout, trim and front matter as they were left.
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    dialog = await openPdfExport(page)
    await expect(dialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Submission' })).toHaveAttribute('aria-pressed', 'true')
    await dialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Print interior' }).click()
    await expect(dialog.getByRole('button', { name: /^Trim size/ })).toHaveText(/5 × 8 in/)
    await expect(dialog.getByRole('textbox', { name: 'Dedication (optional)' })).toHaveValue('For the harbourmaster.')
  })

  test('three Library books as print interiors: checked as a printer would, no widows, orphans or stranded headings, each in under 30 seconds', async ({ page }) => {
    test.setTimeout(600_000)
    await resetDB(page)
    for (const title of ['Pride and Prejudice', 'The Odyssey', 'The Cold Choir']) {
      const worldId = await downloadLibraryBook(page, title)
      // A Library book opens for reading; the writer's tools, Export among them, are in writing mode.
      await page.evaluate(async (w) => {
        const db = (window as unknown as { __pwdb: { worlds: { update(id: string, v: unknown): Promise<unknown> } } }).__pwdb
        await db.worlds.update(w, { readingMode: false })
      }, worldId)
      await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
      const dialog = await openPdfExport(page)
      await dialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Print interior' }).click()
      await dialog.getByRole('button', { name: /^Trim size/ }).click()
      await page.getByRole('option', { name: '6 × 9 in', exact: true }).click()
      const made = await download(page, dialog)
      // The chapters the export carries: those with prose, headed as the dialog heads them.
      const headings = await page.evaluate(async (id) => {
        const db = (window as unknown as { __pwdb: Record<string, { toArray(): Promise<Array<Record<string, unknown>>> }> }).__pwdb
        const [chapters, events, texts] = await Promise.all([db.chapters.toArray(), db.events.toArray(), db.sceneTexts.toArray()])
        const written = new Set(texts.filter((t) => String(t.text ?? '').trim()).map((t) => t.eventId))
        const withProse = new Set(events.filter((e) => e.worldId === id && written.has(e.id)).map((e) => e.chapterId))
        // Each timeline's chapters with prose, in order: the manuscript exports one timeline.
        const byTimeline = new Map<string, Array<readonly [number, string]>>()
        for (const c of chapters.filter((c) => c.worldId === id && withProse.has(c.id)).sort((a, b) => Number(a.number) - Number(b.number))) {
          byTimeline.set(String(c.timelineId), [...(byTimeline.get(String(c.timelineId)) ?? []), [Number(c.number), String(c.title)] as const])
        }
        return [...byTimeline.values()]
      }, worldId)
      const lines = new Set(made.report.pages.flatMap((p) => p.lines.map((l) => l.text)))
      // The timeline exported: the one whose first chapter the file opens. The Odyssey's tale and The Cold Choir's braid are others.
      const exported = headings.map((l) => l.map(([n, t]) => chapterHeadingLines('ch-title', n, t)[0])).find((l) => lines.has(l[0]))
      const trim = TRIM_SIZES.find((t) => t.id === '6x9')!
      // Enough openings that the check is about something: The Cold Choir's, the fewest, are seven.
      expect(exported?.length ?? 0, title).toBeGreaterThan(4)
      expect(printProblems(made.report, { width: trim.width, height: trim.height, headings: exported! }), title).toEqual([])
      const said = await page.evaluate(() => (window as unknown as { __pwpdf?: { last: { pages: number; ms: number; widows: number; orphans: number; stranded: number } | null } }).__pwpdf?.last)
      expect(said?.pages, title).toBe(made.report.pages.length)
      expect([said?.widows, said?.orphans, said?.stranded], title).toEqual([0, 0, 0])
      expect(said!.ms, title).toBeLessThan(30_000)
      console.log(`${title}: ${said!.pages} pages in ${said!.ms} ms`)
      await page.keyboard.press('Escape')
    }
  })
})
