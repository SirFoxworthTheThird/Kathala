import { open, shot, URL } from './lib.mjs';
const [tab] = process.argv.slice(2);
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
await page.getByRole('tab', { name: new RegExp('^' + tab) }).click(); await page.waitForTimeout(1500);
console.log((await page.getByRole('tree').first().innerText()));
const t = await page.locator('main').innerText();
console.log(t.slice(t.indexOf('scenes written')-20, t.indexOf('scenes written')+40));
await ctx.close();
