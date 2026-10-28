import { chromium } from '/home/user/PlotWeave/node_modules/playwright/index.mjs';
export const DIR = '/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/partg/A3';
export const URL = 'http://localhost:5213';
export async function open() {
  const ctx = await chromium.launchPersistentContext(DIR + '/profile', {
    executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
    headless: true, viewport: { width: 1500, height: 1000 }, acceptDownloads: true, downloadsPath: DIR + '/dl',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(15000);
  return { ctx, page };
}
export async function shot(page, name) { await page.screenshot({ path: `${DIR}/shots/${name}.png` }); }
// Capture a file the app hands to the browser as a download (blob/data URL on an <a download>),
// instead of letting Chromium write it (its download path crashes in this sandbox).
export async function captureDownloads(ctx, page) {
  const got = [];
  await ctx.exposeBinding('__saveDownload', (_src, name, b64) => { got.push({ name, b64 }); });
  await ctx.addInitScript(() => {
    try { window.showSaveFilePicker = undefined; } catch {}
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.hasAttribute('download') && /^(blob:|data:)/.test(this.href)) {
        const name = this.getAttribute('download') || 'download';
        fetch(this.href).then(r => r.blob()).then(b => b.arrayBuffer()).then(buf => {
          let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
          window.__saveDownload(name, btoa(s));
        });
        return;
      }
      return orig.call(this);
    };
  });
  return got;
}
