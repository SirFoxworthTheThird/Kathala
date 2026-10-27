import { open, shot, sleep, W } from './lib.mjs';
const { ctx, page } = await open({height: 1400});
await page.goto(W + '/manuscript');
await sleep(3000);
await page.getByRole('tab', { name: /^All timelines/ }).first().click();
await sleep(2000);
const pg = page.getByRole('button', { name: /^Page$/ });
if (await pg.count()) { await pg.click(); await sleep(2000); }
await page.getByRole('button', { name: /^Export/ }).first().click();
await sleep(1500);
const d = page.getByRole('dialog');
console.log(await d.innerText());
const els = await d.locator('input, select, button').all();
for (const e of els) console.log(await e.evaluate(n => `${n.tagName} type=${n.type} aria=${n.getAttribute('aria-label')} txt=${(n.innerText||'').slice(0,40)} checked=${n.checked} val=${n.value}`));
await shot(page, 'exp0');
await ctx.close();
