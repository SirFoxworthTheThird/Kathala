import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const cast = JSON.parse(fs.readFileSync('cast.json','utf8'));
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/characters'); await page.waitForTimeout(2500);
for (const [n, d] of cast) {
  await page.getByRole('button', { name: 'Add Character' }).first().click(); await page.waitForTimeout(400);
  const dl = page.locator('[role=dialog]');
  await dl.getByLabel('Name').fill(n);
  await dl.getByLabel('Description').fill(d);
  await dl.getByRole('button', { name: 'Add Character', exact: true }).click();
  await page.waitForTimeout(800);
  if (await dl.count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  if (!page.url().endsWith('/characters')) { await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/characters'); await page.waitForTimeout(1200); }
}
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/characters'); await page.waitForTimeout(1500);
console.log((await page.locator('main').innerText()).slice(0,1500));
await ctx.close();
