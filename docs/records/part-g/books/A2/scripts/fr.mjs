// node fr.mjs <find> <replace>
import { open, shot, sleep, W } from './lib.mjs';
const [find, repl] = process.argv.slice(2);
const { ctx, page } = await open();
await page.goto(W + '/manuscript');
await sleep(3000);
await page.getByRole('tab', { name: /^All timelines/ }).first().click();
await sleep(2000);
const pg = page.getByRole('button', { name: /^Page$/ });
if (await pg.count()) { await pg.click(); await sleep(2000); }
await page.getByRole('button', { name: /Find & replace/ }).first().click();
await sleep(1000);
const d = page.getByRole('dialog');
const inputs = d.locator('input[type=text], input:not([type]), textarea');
await inputs.nth(0).fill(find);
await inputs.nth(1).fill(repl);
await sleep(1500);
const t = await d.innerText();
console.log(t.slice(0, 800));
const btn = d.getByRole('button', { name: /^Replace all/ });
if (await btn.count() && await btn.isEnabled()) { await btn.click(); await sleep(2500); console.log('--after--'); console.log((await d.innerText()).slice(0,400)); }
await shot(page, 'fr');
await ctx.close();
