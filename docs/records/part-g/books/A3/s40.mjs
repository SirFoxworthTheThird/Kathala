import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw'); await page.waitForTimeout(2500);
console.log(await page.locator('a').evaluateAll(as => as.map(a => (a.getAttribute('aria-label')||a.textContent.trim()).slice(0,30) + ' ' + a.getAttribute('href'))));
await ctx.close();
