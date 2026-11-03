import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/items'); await page.waitForTimeout(2500);
console.log(await page.locator('main').innerText());
await page.getByRole('button', { name: /Add Item|New Item/ }).first().click(); await page.waitForTimeout(800);
console.log('---\n' + await page.locator('[role=dialog]').innerText());
await shot(page, 'additem');
await ctx.close();
