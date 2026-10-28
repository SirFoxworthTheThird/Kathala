// node grabtext.mjs "<phrase>" : print the Page lines around a phrase (searches All timelines page via Ctrl+F)
import { open, URL } from './lib.mjs';
const phrase = process.argv[2];
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
await page.getByRole('tab', { name: /^All timelines/ }).click(); await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Page', exact: true }).click(); await page.waitForTimeout(1500);
await page.locator('.cm-content').click(); 
await page.keyboard.press('Control+f'); await page.waitForTimeout(500);
await page.keyboard.type(phrase); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
await page.keyboard.press('Escape'); await page.waitForTimeout(800);
const lines = await page.locator('.cm-line').allInnerTexts();
const i = lines.findIndex(l => l.includes(phrase));
console.log(i < 0 ? 'NOT FOUND in rendered lines' : lines.slice(Math.max(0,i-2), i+4).join('\n---\n'));
await ctx.close();
