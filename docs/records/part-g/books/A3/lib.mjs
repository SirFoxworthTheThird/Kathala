import { chromium } from '/home/user/PlotWeave/node_modules/playwright/index.mjs';
export const DIR = '/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/partg/A3';
export const URL = 'http://localhost:5213';
export async function open() {
  const ctx = await chromium.launchPersistentContext(DIR + '/profile', {
    executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
    headless: true, viewport: { width: 1500, height: 1000 }, acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(15000);
  return { ctx, page };
}
export async function shot(page, name) { await page.screenshot({ path: `${DIR}/shots/${name}.png` }); }
