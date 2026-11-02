import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/factions'); await page.waitForTimeout(2500);
const names = ['The Halden-Ash Company','The Speakers','Company Security','The Count','The Salt','The Wickwrights','Brightwater Recovery','The Good Title\'s crew'];
for (const n of names) {
  await page.getByRole('button', { name: 'New Faction' }).click(); await page.waitForTimeout(500);
  const inp = page.locator('main input').first();
  await inp.fill(n); await inp.press('Enter'); await page.waitForTimeout(800);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
}
await page.getByText('The Halden-Ash Company').first().click(); await page.waitForTimeout(1000);
await shot(page, 'faction-detail');
console.log(await page.locator('main').innerText());
console.log(await page.locator('main').locator('select, input, textarea, button[aria-haspopup]').evaluateAll(es => es.map(e => e.tagName + ' ' + (e.getAttribute('aria-label')||'') + ' ph=' + (e.placeholder||'') + ' ' + e.textContent.slice(0,40))));
await ctx.close();
