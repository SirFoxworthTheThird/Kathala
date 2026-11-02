import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
const h = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[contenteditable]')];
  return el.map(e => e.tagName + ' ' + e.className.slice(0,200) + ' :: ' + e.outerHTML.slice(0,1500));
});
console.log(h.join('\n\n'));
await ctx.close();
