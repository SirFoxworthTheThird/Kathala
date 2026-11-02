import { open, shot, BASE, sleep } from './lib.mjs';
const { ctx, page } = await open();
const W = BASE + '/#/worlds/qazoRpRKLPklIu-1YyQ3E';
await page.goto(W + '/characters');
await sleep(2500);
console.log(await page.getByRole('main').innerText());
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
await sleep(1000);
const d = page.getByRole('dialog');
console.log('---DIALOG---');
console.log(await d.innerText());
// try to find prompt text in a pre/textarea
const pre = d.locator('pre, textarea');
for (let i=0;i<await pre.count();i++){ console.log('---PRE',i,'---'); console.log(await pre.nth(i).evaluate(n=>n.value||n.textContent)); }
await shot(page, 's08-genchars');
await ctx.close();
