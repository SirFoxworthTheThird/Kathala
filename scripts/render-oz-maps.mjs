/*
  Rasterises the Oz map sources to the PNGs the world references.

  One layer under public/library/the-wonderful-wizard-of-oz/maps/ is a drawn SVG:
  kansas.svg. The other six are supplied images and have no source to rasterise
  (see that folder's SOURCES.md). The `.pwk` points at the rendered PNG because
  that is what the map canvas is known to render; this script is how it is
  reproduced from the source.

  Usage: node scripts/render-oz-maps.mjs
  Requires Playwright's Chromium. In the dev container Playwright is installed
  globally, hence the explicit require path with a local fallback.
*/
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const MAPS = 'public/library/the-wonderful-wizard-of-oz/maps'

function loadChromium() {
  for (const from of ['/opt/node22/lib/node_modules/', `${process.cwd()}/`]) {
    try {
      return createRequire(from)('playwright').chromium
    } catch {
      /* try the next resolution root */
    }
  }
  throw new Error('Playwright is not installed; run `npm i -D playwright` or install it globally.')
}

const chromium = loadChromium()
const sources = fs.readdirSync(MAPS).filter((f) => f.endsWith('.svg')).sort()
if (!sources.length) throw new Error(`no .svg sources in ${MAPS}`)

const browser = await chromium.launch()
for (const file of sources) {
  const svg = fs.readFileSync(path.join(MAPS, file), 'utf8')
  const width = Number(/width="(\d+)"/.exec(svg)[1])
  const height = Number(/height="(\d+)"/.exec(svg)[1])
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style>${svg}`,
    { waitUntil: 'load' },
  )
  const out = path.join(MAPS, file.replace(/\.svg$/, '.png'))
  await page.screenshot({ path: out, type: 'png' })
  await page.close()
  console.log(`${out}  ${width}x${height}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`)
}
await browser.close()
