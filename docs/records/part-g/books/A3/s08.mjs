import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const chs = JSON.parse(fs.readFileSync('chapters.json','utf8'));
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
async function addCh([n, era, title, syn]) {
  await page.getByRole('button', { name: 'Add Chapter' }).click();
  const d = page.locator('[role=dialog]');
  await d.getByLabel('Title').fill(title);
  await d.getByLabel('Number').fill(String(n));
  await d.getByLabel('Synopsis').fill(syn);
  await page.waitForTimeout(300);
  await d.getByRole('button', { name: 'Add Chapter' }).click();
  await page.waitForTimeout(900);
}
for (const c of chs.filter(c => c[1]==='I' && c[0] !== 1)) await addCh(c);
await shot(page, 'closing-chs');
for (const [tl, era] of [['The Owing','II'],['The Healing','III']]) {
  await page.getByRole('button', { name: 'New Timeline' }).click();
  await page.locator('[role=dialog]').getByLabel('Timeline name').fill(tl);
  await page.locator('[role=dialog]').getByRole('button', { name: 'Add timeline' }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'tl-' + era);
  for (const c of chs.filter(c => c[1]===era)) await addCh(c);
}
await shot(page, 'after-all');
console.log((await page.locator('main').innerText()).slice(0,3000));
await ctx.close();
