import { test, expect } from '@playwright/test'
import { readFile } from 'fs/promises'
import { resetDB } from './helpers/reset'
import { readStoredZip } from '../src/lib/zip'

/*
  UX-2-14: every cover in the Library is WebP, and the export took only JPEG
  and PNG, so a Library book exported with *Include world cover* left ticked —
  the default — downloaded nothing and put a red line far up the dialog. A
  WebP cover now goes into the file as a JPEG.
*/
test('a WebP cover goes into Word and EPUB as a JPEG, with the box left ticked', async ({ page }) => {
  test.setTimeout(120_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill('# The Salt Ledger\n\n## Chapter 1: The Weighing House\n\nThe weighing house opened before the tide turned.')
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  // A WebP cover, made by the browser, as the Library's are.
  const type = await page.evaluate(async (id: string) => {
    const canvas = document.createElement('canvas')
    canvas.width = 60
    canvas.height = 90
    const g = canvas.getContext('2d')!
    g.fillStyle = '#2a6'
    g.fillRect(0, 0, 60, 90)
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/webp', 0.8))
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; update: (k: string, v: unknown) => Promise<unknown> }>
    await db.blobs.add({ id: 'cover-webp', worldId: id, mimeType: blob.type, data: blob, createdAt: Date.now() })
    await db.worlds.update(id, { coverImageId: 'cover-webp' })
    return blob.type
  }, worldId)
  expect(type).toBe('image/webp')

  await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
  await expect(page.getByRole('main').getByText('The weighing house opened before the tide turned.')).toBeVisible()
  await page.getByRole('main').getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export manuscript' })

  for (const [format, ext, media] of [['Word', 'docx', 'word/media/cover.jpg'], ['EPUB', 'epub', 'OEBPS/cover.jpg']] as const) {
    await dialog.getByRole('button', { name: format, exact: true }).click()
    await expect(dialog.getByRole('checkbox', { name: /Include world cover/ })).toBeChecked()
    const pending = page.waitForEvent('download')
    await dialog.getByRole('button', { name: `Download .${ext}` }).click()
    const file = await pending
    const zip = readStoredZip(new Uint8Array(await readFile(await file.path())))
    const cover = zip.get(media)
    expect(cover, `${format} carries ${media}`).toBeDefined()
    // A JPEG's first bytes.
    expect([...cover!.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff])
    await expect(dialog.getByRole('alert')).toHaveCount(0)
  }
})
