// node pastech.mjs <tab> <file> <new|append> [synopsis]
import { open, shot, sleep, pasteText, italics, W, DIR } from './lib.mjs';
import fs from 'fs';
const [tab, file, mode, synopsis] = process.argv.slice(2);
const { ctx, page } = await open();
await page.goto(W + '/manuscript');
await sleep(3000);
await page.getByRole('tab', { name: new RegExp('^' + tab) }).first().click();
await sleep(2000);
let text = italics(fs.readFileSync(DIR + '/chapters/' + file, 'utf8')).trim() + '\n';
const title = text.match(/^# (.*)$/m)[1];
if (mode === 'new') {
  await page.getByRole('button', { name: 'Add Chapter' }).first().click();
  await sleep(800);
  const d = page.getByRole('dialog');
  await d.locator('#chapter-title').fill(title);
  if (synopsis) await d.locator('#chapter-synopsis').fill(synopsis);
  console.log('number', await d.locator('#chapter-number').inputValue());
  await d.getByRole('button', { name: 'Add Chapter' }).click();
  await sleep(2000);
  const pg = page.getByRole('button', { name: /^Page$/ });
  if (await pg.count()) { await pg.click(); await sleep(2000); }
  const heads = page.locator('.cm-content .cm-draft-chapter');
  const h = heads.last();
  await h.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await sleep(500);
  const body = text.slice(text.indexOf('\n## ') + 1);
  await pasteText(page, body);
} else {
  const pg = page.getByRole('button', { name: /^Page$/ });
  if (await pg.count()) { await pg.click(); await sleep(2000); }
  const lines = page.locator('.cm-content .cm-line');
  await lines.last().click();
  await page.keyboard.press('Control+End');
  await sleep(300);
  await pasteText(page, '\n\n' + text);
}
await sleep(12000);
const m = await page.getByRole('main').innerText();
const i = m.indexOf('Header cheat sheet');
console.log('NOTICE:', m.slice(Math.max(0, i - 700), i));
await shot(page, 'pastech-' + file);
await ctx.close();
