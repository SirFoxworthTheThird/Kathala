// node facts.mjs facts.json
import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const facts = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/knowledge'); await page.waitForTimeout(2500);
const main = page.locator('main');
for (const f of facts) {
  const exists = await main.getByText(f.title, { exact: true }).count();
  if (!exists) {
    await page.getByRole('button', { name: 'New Fact' }).click(); await page.waitForTimeout(500);
    await main.getByPlaceholder('What is the fact or secret?').fill(f.title);
    await page.keyboard.press('Enter'); await page.waitForTimeout(900);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
  await main.getByText(f.title, { exact: true }).first().click(); await page.waitForTimeout(900);
  if (f.desc) { const d = main.getByPlaceholder('What is this information?'); await d.fill(f.desc); await d.blur(); await page.waitForTimeout(400); }
  if (f.reader) {
    await main.getByRole('button', { name: /^(Auto — when a POV character knows it|Ch\.\d+ — .*)$/ }).first().click(); await page.waitForTimeout(500);
    await page.getByRole('option', { name: f.reader, exact: true }).click(); await page.waitForTimeout(700);
  }
  if (f.trueAt) {
    await main.getByRole('button', { name: /^(True from the start|Ch\.\d+ — .*)$/ }).last().click(); await page.waitForTimeout(500);
    await page.getByRole('option', { name: f.trueAt, exact: true }).click(); await page.waitForTimeout(700);
  }
  for (const [who, when] of (f.knowers || [])) {
    await main.getByRole('button', { name: 'Character…' }).click(); await page.waitForTimeout(400);
    await page.getByRole('option', { name: who, exact: true }).click(); await page.waitForTimeout(400);
    await main.getByRole('button', { name: 'Learns it at…' }).click(); await page.waitForTimeout(400);
    await page.getByRole('option', { name: when, exact: true }).first().click(); await page.waitForTimeout(400);
    await main.getByRole('button', { name: 'Record who learns it' }).click(); await page.waitForTimeout(700);
  }
  if (f.words && f.words.length) {
    const box = main.getByPlaceholder(/A name, a nickname/).first();
    if (await box.count()) { for (const w of f.words) { await box.fill(w); await box.press('Enter'); await page.waitForTimeout(300); } }
    else console.log('no words box for', f.title);
  }
  await page.waitForTimeout(500);
  console.log('done', f.title);
}
await shot(page, 'facts-last');
await ctx.close();
