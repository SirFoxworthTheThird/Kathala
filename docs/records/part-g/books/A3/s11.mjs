import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/settings'); await page.waitForTimeout(2500);
await shot(page, 'settings');
console.log((await page.locator('main').innerText()).slice(0,5000));
await ctx.close();
