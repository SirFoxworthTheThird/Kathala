import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const pages = JSON.parse(fs.readFileSync('lore.json','utf8'));
const { ctx, page } = await open();
let first = true;
for (const [title, body] of pages) {
  if (first) { await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/lore/Hw803NoiiiT3RPtKp3jza'); first = false; }
  else { await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/lore'); await page.waitForTimeout(1800); await page.getByRole('button', { name: 'New Page' }).click(); }
  await page.waitForTimeout(1800);
  await page.getByPlaceholder('Untitled').fill(title);
  const ta = page.getByPlaceholder(/Write your lore here/);
  await ta.fill(body); await ta.blur(); await page.waitForTimeout(1500);
  console.log('saved', title);
}
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/lore'); await page.waitForTimeout(1800);
console.log((await page.locator('main').innerText()).slice(0,800));
await ctx.close();
