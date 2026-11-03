import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const places = JSON.parse(fs.readFileSync('places.json','utf8'));
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/maps'); await page.waitForTimeout(2500);
for (const [n, t, desc] of places) {
  await page.getByRole('button', { name: /Add a place/ }).first().click(); await page.waitForTimeout(600);
  const d = page.locator('[role=dialog]');
  await d.getByLabel(/Name/).fill(n);
  await d.getByLabel('Type').click(); await page.waitForTimeout(300);
  await page.getByRole('option', { name: t, exact: true }).click(); await page.waitForTimeout(200);
  await d.getByLabel('Description').fill(desc);
  await d.getByRole('button', { name: 'Add Location' }).click(); await page.waitForTimeout(800);
  if (await d.count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
}
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/maps'); await page.waitForTimeout(1500);
console.log(await page.locator('main').innerText());
await ctx.close();
