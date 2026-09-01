/*
  Renders a shipped world's map layers with every location marker drawn on top,
  so EX-206 can actually be checked — by looking at the picture, which is what
  the rule asks for and what numeric inspection cannot do.

  Leaflet's CRS.Simple counts y upward from the bottom of the image and the
  stored `y` follows it, so this flips back to display coordinates the same way
  the app does. Getting that backwards is the classic way a marker set passes
  every arithmetic check and still sits in the sea.

    node scripts/check-map-markers.mjs <world.pwk> <outDir> [layerFilter]
    node scripts/check-map-markers.mjs <world.pwk> <outDir> <layer> <x> <y> <w> <h> <zoom>

  The second form crops, so a crowded strip can be read at a useful size.
  Screenshots go to <outDir>, which should be outside the repository — nothing
  here is meant to be committed.
*/
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const [pwk, outDir, filter, cx, cy, cw, ch, cz] = process.argv.slice(2)
if (!pwk || !outDir) {
  console.error('usage: node scripts/check-map-markers.mjs <world.pwk> <outDir> [layer] [x y w h zoom]')
  process.exit(1)
}
const world = JSON.parse(fs.readFileSync(pwk, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

/* The repo's own Chromium. Playwright's default headless-shell build is not
   installed here, so the browser has to be named rather than discovered. */
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath })
const page = await browser.newPage()

const crop = cx !== undefined
const zoom = crop ? Number(cz) : 2

for (const layer of world.mapLayers) {
  if (filter && !layer.id.includes(filter)) continue
  const blob = world.blobs.find((b) => b.id === layer.imageId)
  const b64 = fs.readFileSync(path.resolve('public', blob.url)).toString('base64')
  const markers = world.locationMarkers
    .filter((m) => m.mapLayerId === layer.id)
    .map((m) => ({ x: m.x, y: layer.imageHeight - m.y, name: m.name }))
  const [x0, y0, w, h] = crop
    ? [Number(cx), Number(cy), Number(cw), Number(ch)]
    : [0, 0, layer.imageWidth, layer.imageHeight]
  await page.setViewportSize({ width: Math.round(w * zoom), height: Math.round(h * zoom) })
  await page.setContent(`<style>html,body{margin:0;overflow:hidden}
#v{position:relative;width:${w * zoom}px;height:${h * zoom}px;overflow:hidden}
#w{position:absolute;left:${-x0 * zoom}px;top:${-y0 * zoom}px;width:${layer.imageWidth * zoom}px;height:${layer.imageHeight * zoom}px}
img{width:100%;height:100%}
.p{position:absolute;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:#ff1e6e;border:2px solid #fff}
.l{position:absolute;transform:translate(8px,-50%);font:bold 12px system-ui;color:#fff;background:rgba(0,0,0,.75);padding:1px 3px;border-radius:3px;white-space:nowrap}</style>
<div id="v"><div id="w"><img src="data:${blob.mimeType};base64,${b64}">
${markers.map((m) => {
    const name = m.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    return `<div class="p" style="left:${m.x * zoom}px;top:${m.y * zoom}px"></div><div class="l" style="left:${m.x * zoom}px;top:${m.y * zoom}px">${name}</div>`
  }).join('\n')}
</div></div>`)
  await page.waitForTimeout(200)
  const file = `${outDir}/${layer.id}.png`
  await page.locator('#v').screenshot({ path: file })
  console.log(file, markers.length, 'markers')
}
await browser.close()
