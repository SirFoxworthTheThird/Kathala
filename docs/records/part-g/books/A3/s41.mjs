import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw'); await page.waitForTimeout(2500);
const btns = await page.locator('header button, [role=banner] button').evaluateAll(bs => bs.map(b => (b.getAttribute('aria-label')||'') + '|' + (b.title||'') + '|' + b.textContent.trim().slice(0,20)));
console.log(btns);
await ctx.close();
