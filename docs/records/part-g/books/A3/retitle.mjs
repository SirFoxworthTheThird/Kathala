import { open, URL } from './lib.mjs';
const [tab, num, oldT, newT, syn] = process.argv.slice(2);
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
await page.getByRole('tab', { name: new RegExp('^' + tab) }).click(); await page.waitForTimeout(1500);
await page.getByRole('tree').first().getByText(`Ch. ${num} · ${oldT}`).click(); await page.waitForTimeout(2000);
const panel = page.getByRole('region', { name: `Chapter ${num}` });
await panel.getByLabel('Chapter title').fill(newT); await panel.getByLabel('Chapter title').press('Enter'); await page.waitForTimeout(600);
if (syn) { await panel.getByLabel('Chapter synopsis').fill(syn); await panel.getByLabel('Chapter synopsis').press('Enter'); }
await page.waitForTimeout(1200);
console.log(await page.getByRole('tree').first().innerText());
await ctx.close();
