import { open, shot, sleep, W } from './lib.mjs';
const { ctx, page } = await open({height: 1400});
await page.goto(W);
await sleep(3000);
const btns = await page.locator('header button, [role=banner] button, nav button').all();
for (const b of btns) console.log('B', await b.getAttribute('aria-label'), await b.getAttribute('title'), JSON.stringify((await b.innerText()).slice(0,30)));
console.log(page.url());
await ctx.close();
