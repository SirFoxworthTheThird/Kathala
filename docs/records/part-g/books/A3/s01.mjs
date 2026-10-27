import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL); await page.waitForTimeout(2000);
await shot(page, 'home');
console.log(await page.locator('body').innerText());
await ctx.close();
