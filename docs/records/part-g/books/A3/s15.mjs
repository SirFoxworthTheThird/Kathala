import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/settings'); await page.waitForTimeout(2500);
async function setStart(name, d, m, y, era) {
  const g = page.getByRole('group', { name });
  await g.getByLabel('Year era').selectOption(String(era)); await page.waitForTimeout(400);
  await g.getByLabel('Year', { exact: true }).fill(String(y)); await g.getByLabel('Year', { exact: true }).blur(); await page.waitForTimeout(400);
  await g.getByLabel('Month').selectOption(String(m)); await page.waitForTimeout(400);
  await g.getByLabel('Day').fill(String(d)); await g.getByLabel('Day').blur(); await page.waitForTimeout(600);
}
await setStart('The Closing', 9, 2, 2387, 0);
await setStart('The Owing', 14, 7, 311, 1);
await setStart('The Healing', 2, 4, 702, 1);
await page.waitForTimeout(800);
const t = await page.locator('main').innerText();
console.log(t.slice(t.indexOf('TIMELINES'), t.indexOf('A scene pinned')).replace(/January\nFebruary\nMarch\nApril\nMay\nJune\nJuly\nAugust\nSeptember\nOctober\nNovember\nDecember\n/g,''));
for (const n of ['The Closing','The Owing','The Healing']) { const g = page.getByRole('group',{name:n}); console.log(n, await g.getByLabel('Day').inputValue(), await g.getByLabel('Month').inputValue(), await g.getByLabel('Year',{exact:true}).inputValue(), await g.getByLabel('Year era').inputValue()); }
await ctx.close();
