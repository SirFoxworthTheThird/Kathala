import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/items'); await page.waitForTimeout(2500);
await page.locator('main').getByText('The Mercy Bell', { exact: true }).first().click(); await page.waitForTimeout(2000);
console.log((await page.locator('main').innerText()).slice(0, 4000));
await shot(page, 'bellitem');
await ctx.close();
