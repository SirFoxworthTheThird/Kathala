import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/knowledge'); await page.waitForTimeout(2500);
const main = page.locator('main');
async function fix(title, who, when) {
  await main.getByText(title, { exact: true }).first().click(); await page.waitForTimeout(1000);
  const row = main.locator('div').filter({ hasText: new RegExp('^' + who) }).filter({ has: page.getByRole('button') }).last();
  const rm = main.getByRole('button', { name: who + ' does not know this' });
  if (await rm.count()) { await rm.first().click(); }
  else { console.log('no remove button by name; buttons:', await main.getByRole('button').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label')).filter(Boolean).slice(-15))); }
  await page.waitForTimeout(700);
  await main.getByRole('button', { name: 'Character…' }).click(); await page.waitForTimeout(400);
  await page.getByRole('option', { name: who, exact: true }).click(); await page.waitForTimeout(400);
  await main.getByRole('button', { name: 'Learns it at…' }).click(); await page.waitForTimeout(400);
  await page.getByRole('option', { name: when, exact: true }).first().click(); await page.waitForTimeout(400);
  await main.getByRole('button', { name: 'Record who learns it' }).click(); await page.waitForTimeout(900);
  console.log('fixed', title, who);
}
await fix('Kas sold the root plan to Achterberg for two seats on the Covenant', 'Ruth Achterberg', 'Ch.16 — The Root');
await fix('The Hulk is the carrier Covenant, come home', 'Hale Varga', 'Ch.19 — Iron on Iron');
await ctx.close();
