import { open, shot, sleep, pasteText, W } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(W + '/manuscript');
await sleep(3000);
const tree = page.getByRole('tree');
const ch = tree.getByRole('treeitem').first();
await ch.focus();
await page.keyboard.press('ArrowRight');
await sleep(800);
const items = tree.getByRole('treeitem');
for (let i=0;i<await items.count();i++) console.log(i, JSON.stringify(await items.nth(i).innerText()));
// select the first scene (index 1) and delete
await page.keyboard.press('ArrowDown');
await sleep(300);
const focused = await page.evaluate(() => document.activeElement.innerText);
console.log('focused:', focused);
if (focused.trim().startsWith('The line')) {
  await page.keyboard.press('Delete');
  await sleep(1500);
}
for (let i=0;i<await items.count();i++) console.log(i, JSON.stringify(await items.nth(i).innerText()));
console.log((await page.locator('body').innerText()).match(/Undo[^\n]*/g));
await shot(page, 't5');
await ctx.close();
