import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const items = JSON.parse(fs.readFileSync('items.json','utf8'));
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/items'); await page.waitForTimeout(2500);
for (const [n, desc] of items) {
  await page.getByRole('button', { name: 'Add Item' }).first().click(); await page.waitForTimeout(500);
  const d = page.locator('[role=dialog]');
  await d.getByLabel('Name').fill(n);
  await d.getByLabel('Description').fill(desc);
  await d.getByRole('button', { name: 'Add Item', exact: true }).click(); await page.waitForTimeout(800);
  if (await d.count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  if (!page.url().endsWith('/items')) { await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/items'); await page.waitForTimeout(1200); }
}
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/items'); await page.waitForTimeout(1500);
console.log((await page.locator('main').innerText()).slice(0,1500));
await ctx.close();
