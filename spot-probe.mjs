import { chromium } from '@playwright/test'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => {
  const set = Storage.prototype.setItem
  let last
  Storage.prototype.setItem = function (k, v) {
    if (k === 'kathala-ui' && window.__trace) {
      const now = JSON.parse(v).state.activeEventId
      if (now !== last) console.log('CURSOR', Math.round(performance.now()), now)
      last = now
    }
    return set.call(this, k, v)
  }
  new MutationObserver(() => {
    const t = [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Undo').length
    if (window.__trace && t !== window.__undoCount) { console.log('UNDO buttons', Math.round(performance.now()), t); window.__undoCount = t }
  }).observe(document, { childList: true, subtree: true })
})
const page = await ctx.newPage()
page.on('console', (m) => { if (/^(CURSOR|UNDO)/.test(m.text())) console.log(m.text()) })
const BASE = 'http://localhost:4173'
await page.goto(BASE + '/', { waitUntil: 'load' })
const worldId = await page.evaluate(() => window.__pwlibrary.install('The Count of Monte Cristo'))
await page.goto(`${BASE}/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
const sc = page.locator('[data-book-scroller]')
await page.locator('[data-scene-event-id]').first().waitFor({ timeout: 60000 })
await page.waitForTimeout(3000)
await page.evaluate(() => { window.__trace = true })
await sc.evaluate((el) => { el.scrollTop = 60000 })
await page.waitForTimeout(5000)
await browser.close()
