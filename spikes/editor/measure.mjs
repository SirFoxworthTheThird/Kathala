/*
  Drive the three candidates in Chromium and print what they cost and whether
  the heading ids behave. Serve a build of this folder first:

    npx vite build spikes/editor --outDir <dir>
    (cd <dir> && python3 -m http.server 5199)
    node spikes/editor/measure.mjs [textarea,codemirror,prosemirror]

  RUNS (default 3) repeats the timings; the edit scenarios run once each, on a
  fresh load, because each one starts from the book as it was composed.
*/
import { chromium } from '@playwright/test'
import { writeFileSync } from 'fs'

const BASE = process.env.SPIKE_BASE ?? 'http://localhost:5199'
const RUNS = Number(process.env.RUNS ?? 3)
const editors = (process.argv[2] ?? 'textarea,codemirror,prosemirror').split(',')
const OUT = process.env.SPIKE_OUT ?? 'spike-results.json'
const SENTENCE = 'He looked at the sea a long while, and then he said nothing at all to anybody there.'

const browser = await chromium.launch({
  executablePath: process.env.SPIKE_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] })

async function open(editor) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  await page.goto(`${BASE}/?editor=${editor}`)
  await page.waitForSelector('body[data-ready="1"]', { timeout: 180_000 })
  return { page, close: () => context.close() }
}

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
  return { n: s.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1) }
}

async function typing(page, fraction) {
  await page.evaluate((f) => {
    window.spike.proseCaret(f)
    window.__lat = []
    if (!window.__listening) {
      window.__listening = true
      // From the key to the first moment after the frame that shows it. The
      // Event Timing API was tried as well and is not used: in this headless,
      // software-rendered Chromium it reported waits of 3.7 s at the end of the
      // book while a trace of the same typing showed a frame drawn for every
      // key and no task on any thread over 8 ms.
      document.addEventListener('keydown', (e) => {
        const t0 = e.timeStamp
        requestAnimationFrame(() => setTimeout(() => window.__lat.push(performance.now() - t0)))
      }, true)
    }
  }, fraction)
  await page.waitForTimeout(500)
  const visibleBefore = await page.evaluate(() => window.spike.caretVisible())
  await page.keyboard.type(SENTENCE, { delay: 60 })
  await page.waitForTimeout(500)
  const visibleAfter = await page.evaluate(() => window.spike.caretVisible())
  const lat = await page.evaluate(() => window.__lat)
  return { ...stats(lat), visibleBefore, visibleAfter }
}

async function scrolling(page) {
  const box = await page.evaluate(() => {
    const el = window.spike.scroller()
    el.scrollTop = 0
    const r = el.getBoundingClientRect()
    window.__frames = []
    window.__long = 0
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long += e.duration }).observe({ type: 'longtask' })
    let last = performance.now()
    window.__run = true
    const tick = (t) => { window.__frames.push(t - last); last = t; if (window.__run) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(box.x, box.y)
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(40) }
  await page.waitForTimeout(300)
  const wheel = await page.evaluate(() => {
    window.__run = false
    const f = window.__frames.slice(1)
    return { frames: f.length, over50: f.filter((d) => d > 50).length, worstFrame: Math.max(...f), longTaskMs: window.__long }
  })
  const jump = await page.evaluate(async () => {
    const el = window.spike.scroller()
    const t0 = performance.now()
    el.scrollTop = el.scrollHeight
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return performance.now() - t0
  })
  return { ...wheel, worstFrame: +wheel.worstFrame.toFixed(1), longTaskMs: +wheel.longTaskMs.toFixed(0), jumpToEndMs: +jump.toFixed(1) }
}

async function timings(editor) {
  const { page, close } = await open(editor)
  const load = await page.evaluate(() => window.spike.loadMs)
  const domNodes = await page.evaluate(() => document.getElementsByTagName('*').length)
  const heapMB = await page.evaluate(async () => {
    window.gc?.()
    await new Promise((r) => setTimeout(r, 200))
    return performance.memory.usedJSHeapSize / 1048576
  })
  const roundTrip = await page.evaluate(() => {
    const want = window.spike.book.chapters.flatMap((c) => c.scenes.map((s) => s.text))
    const got = window.spike.sceneTexts()
    return { scenes: got.length, mismatched: want.filter((t, i) => t !== got[i]).length }
  })
  const typeMiddle = await typing(page, 0.5)
  const typeEnd = await typing(page, 0.95)
  const scroll = await scrolling(page)
  await close()
  return { loadMs: +load.toFixed(0), domNodes, heapMB: +heapMB.toFixed(1), roundTrip, typeMiddle, typeEnd, scroll }
}

// ── Heading ids ───────────────────────────────────────────────────────────────

const MOD = 'Control'

/** A scene heading in the middle of the book that follows another scene, not its chapter's heading. */
async function target(page) {
  return page.evaluate(() => {
    const h = window.spike.headings()
    const candidates = h.map((x, i) => i).filter((i) => i > 0 && h[i].level === 2 && h[i - 1].level === 2)
    const i = candidates[Math.floor(candidates.length / 2)]
    return { i, id: h[i].id, title: h[i].title, count: h.length, ids: h.map((x) => x.id) }
  })
}
const headings = (page) => page.evaluate(() => window.spike.headings())
const unique = (hs) => { const ids = hs.map((h) => h.id).filter(Boolean); return ids.length === new Set(ids).size }

const scenarios = {
  async 'retype the title'(page, t, syntax) {
    await page.evaluate((i) => window.spike.select('title', i), t.i)
    await page.keyboard.type('Renamed title')
    await page.keyboard.press('ArrowDown')
    const h = await headings(page)
    return { pass: h[t.i].id === t.id && h[t.i].title === 'Renamed title' && unique(h), detail: h[t.i] }
  },
  async 'select the whole line and retype it'(page, t, syntax) {
    await page.evaluate((i) => window.spike.select('line', i), t.i)
    await page.keyboard.type(`${syntax}Retyped line`)
    await page.keyboard.press('ArrowDown')
    const h = await headings(page)
    return { pass: h[t.i].id === t.id && h[t.i].title === 'Retyped line' && unique(h), detail: h[t.i] }
  },
  async 'clear the line, then type a new heading'(page, t, syntax) {
    await page.evaluate((i) => window.spike.select('line', i), t.i)
    await page.keyboard.press('Backspace')
    await page.keyboard.type(`${syntax}Cleared and retyped`)
    await page.keyboard.press('ArrowDown')
    const h = await headings(page)
    return { pass: h[t.i].id === t.id && h[t.i].title === 'Cleared and retyped' && unique(h), detail: h[t.i] }
  },
  async 'Enter in the middle of the title, then undo'(page, t) {
    await page.evaluate((i) => window.spike.headingCaret(i, 'title'), t.i)
    for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    const split = await headings(page)
    await page.keyboard.press(`${MOD}+z`)
    const back = await headings(page)
    return {
      pass: split[t.i].id === t.id && unique(split) && back[t.i].id === t.id && back[t.i].title === t.title && back.length === t.count,
      detail: { afterSplit: split.slice(t.i, t.i + 2), headingsAfterSplit: split.length - t.count },
    }
  },
  async 'Enter at the start of the heading pushes it down with its id'(page, t) {
    await page.evaluate((i) => window.spike.headingCaret(i, 'lineStart'), t.i)
    await page.keyboard.press('Enter')
    const h = await headings(page)
    const moved = h.find((x) => x.title === t.title)
    return { pass: moved?.id === t.id && unique(h), detail: { moved, count: h.length - t.count } }
  },
  async 'Backspace until it joins the scene above, then undo'(page, t) {
    await page.evaluate((i) => window.spike.headingCaret(i, 'lineStart'), t.i)
    let presses = 0
    let h = await headings(page)
    while (h.length === t.count && presses < 4) { await page.keyboard.press('Backspace'); presses++; h = await headings(page) }
    const joined = !h.some((x) => x.id === t.id)
    const dormant = await page.evaluate(() => window.spike.dormant())
    let undos = 0
    while (undos < 4) {
      await page.keyboard.press(`${MOD}+z`); undos++
      h = await headings(page)
      if (h.length === t.count && h[t.i].title === t.title) break
    }
    return {
      pass: joined && !dormant.includes(t.id) && h[t.i].id === t.id && unique(h),
      detail: { backspaces: presses, undos, restored: h[t.i] },
    }
  },
  async 'cut the heading line, then undo'(page, t) {
    await page.evaluate((i) => window.spike.select('block', i), t.i)
    await page.keyboard.press(`${MOD}+x`)
    const cut = await headings(page)
    await page.keyboard.press(`${MOD}+z`)
    const back = await headings(page)
    return { pass: !cut.some((x) => x.id === t.id) && back[t.i].id === t.id && unique(back), detail: { cutCount: cut.length - t.count } }
  },
  async 'copy the heading and paste it elsewhere: the copy is new'(page, t, syntax, enters) {
    await page.evaluate((i) => window.spike.select('block', i), t.i)
    await page.keyboard.press(`${MOD}+c`)
    await page.evaluate(() => window.spike.proseCaret(0.2))
    for (let k = 0; k < enters; k++) await page.keyboard.press('Enter')
    await page.keyboard.press(`${MOD}+v`)
    const h = await headings(page)
    const copies = h.filter((x) => x.title === t.title)
    return {
      pass: copies.length === 2 && copies.filter((x) => x.id === t.id).length === 1 && copies.some((x) => x.id === null) && unique(h),
      detail: copies,
    }
  },
  async 'type a new heading in the prose: a new scene, and nothing else changes'(page, t, syntax, enters) {
    await page.evaluate(() => window.spike.proseCaret(0.3))
    for (let k = 0; k < enters; k++) await page.keyboard.press('Enter')
    await page.keyboard.type('## A new scene')
    await page.keyboard.press('ArrowDown')
    const h = await headings(page)
    const added = h.filter((x) => x.title === 'A new scene')
    const rest = h.filter((x) => x.title !== 'A new scene').map((x) => x.id)
    return { pass: added.length === 1 && added[0].id === null && JSON.stringify(rest) === JSON.stringify(t.ids), detail: added }
  },
}

const results = { at: new Date().toISOString(), timings: {}, ids: {} }
for (const editor of editors) {
  results.timings[editor] = []
  for (let r = 0; r < RUNS; r++) {
    const run = await timings(editor)
    results.timings[editor].push(run)
    console.log(editor, `run ${r + 1}`, JSON.stringify(run))
  }
  const probe = await open(editor)
  const hasIds = await probe.page.evaluate(() => window.spike.ids)
  await probe.close()
  if (!hasIds) continue
  // CodeMirror's syntax is text, typed like prose: `## ` included, and a blank
  // line before it. ProseMirror's is an input rule, and Enter makes a paragraph.
  const syntax = editor === 'codemirror' ? '## ' : ''
  const enters = editor === 'codemirror' ? 2 : 1
  results.ids[editor] = {}
  for (const [name, run] of Object.entries(scenarios)) {
    const { page, close } = await open(editor)
    const t = await target(page)
    let outcome
    try { outcome = await run(page, t, syntax, enters) } catch (e) { outcome = { pass: false, detail: String(e) } }
    const collisions = await page.evaluate(() => window.__collisions ?? 0)
    await close()
    results.ids[editor][name] = { ...outcome, collisions }
    console.log(editor, outcome.pass ? 'PASS' : 'FAIL', name, JSON.stringify(outcome.detail))
  }
}
writeFileSync(OUT, JSON.stringify(results, null, 2))
await browser.close()
