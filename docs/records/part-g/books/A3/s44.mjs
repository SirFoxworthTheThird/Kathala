import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw'); await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Continuity Checker' }).first().click(); await page.waitForTimeout(6000);
const b = page.getByRole('button', { name: /Record every name as mentioned/ });
if (await b.count()) { await b.first().click(); await page.waitForTimeout(5000); }
const t = await page.locator('[role=dialog]').last().innerText();
fs.writeFileSync('checker.txt', t);
console.log(t.slice(0, 5000));
await ctx.close();
