import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/characters'); await page.waitForTimeout(2500);
console.log(await page.locator('main').innerText());
const b = page.getByRole('button', { name: /New Character|Add Character|New character/ }).first();
await b.click(); await page.waitForTimeout(800);
console.log('---\n' + await page.locator('[role=dialog]').innerText());
await shot(page, 'newchar');
await ctx.close();
