// usage: node paste.mjs <timelineTab> <chapterTitle> <file> [existingScene]
import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const [tab, chTitle, file, existing] = process.argv.slice(2);
let text = fs.readFileSync(file, 'utf8').replace(/\r/g,'');
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
await page.getByRole('tab', { name: new RegExp('^' + tab) }).click(); await page.waitForTimeout(1500);
// binder: pick the chapter
const binder = page.getByRole('tree').first();
await binder.getByText(new RegExp('· ' + chTitle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$')).first().click();
await page.waitForTimeout(1500);
const ed = page.locator('.cm-content');
if (existing) {
  // paste into the existing first scene: strip its heading from text
  const first = text.indexOf('\n'); text = text.slice(first + 1).replace(/^\n+/, '');
  const line = page.locator('.cm-line.cm-draft-scene', { hasText: existing }).first();
  await line.click(); await page.keyboard.press('End'); await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
} else {
  const line = page.locator('.cm-line.cm-draft-chapter', { hasText: chTitle }).first();
  await line.click(); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
}
await page.evaluate(t => navigator.clipboard.writeText(t), text);
await page.keyboard.press('Control+V');
await page.waitForTimeout(4000);
// leave the line / let headers apply
await page.keyboard.press('Control+End').catch(()=>{});
await page.waitForTimeout(6000);
await shot(page, 'paste-' + chTitle.replace(/\W+/g,'_'));
const notes = await page.locator('main').innerText();
console.log(notes.slice(0, 1500));
await ctx.close();
