import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
await shot(page, 'state');
console.log((await page.locator('main').innerText()).slice(0,2500));
await ctx.close();
