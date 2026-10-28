// node replace.mjs pairs.json   ([[find, replace], ...]) — case sensitive, across the whole book
import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const pairs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
await page.getByRole('tab', { name: /^All timelines/ }).click(); await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Page', exact: true }).click(); await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Find & replace/ }).click(); await page.waitForTimeout(800);
const d = page.locator('[role=dialog]');
const cs = d.getByLabel('Case sensitive'); if (!(await cs.isChecked())) await cs.check();
for (const [f, r] of pairs) {
  await d.getByPlaceholder('Find…').fill(f); await page.waitForTimeout(900);
  await d.getByPlaceholder('Replace with…').fill(r); await page.waitForTimeout(400);
  const txt = await d.innerText();
  const m = txt.match(/(\d+) (match|matches|result)[^\n]*/i);
  console.log(JSON.stringify(f.slice(0,40)), '->', m ? m[0] : txt.split('\n').slice(3,6).join(' | '));
  await d.getByRole('button', { name: /Replace all/ }).click(); await page.waitForTimeout(1200);
}
await ctx.close();
