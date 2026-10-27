import { open, shot, sleep, W } from './lib.mjs';
const { ctx, page } = await open({height: 1400});
await page.goto(W + '/knowledge');
await sleep(3000);
await page.getByText('Hale sold Maren for the Purchase', { exact: true }).first().click();
await sleep(1000);
const b = page.getByRole('button', { name: /Remove.*one name/ });
console.log('rm', await b.count()); if (await b.count()) await b.first().click();
await sleep(800);
await page.locator('button[aria-label="Continuity Checker"]').first().click();
await sleep(5000);
const r = page.getByRole('button', { name: /Record every name as mentioned/ });
console.log('rec', await r.count()); if (await r.count()) { await r.first().click(); await sleep(4000); }
const t = await page.locator('body').innerText();
console.log(t.slice(t.indexOf('Continuity Checker'), t.indexOf('Continuity Checker')+200));
await ctx.close();
