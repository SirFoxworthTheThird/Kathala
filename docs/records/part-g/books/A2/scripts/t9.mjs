import { open, shot, sleep, W } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(W + '/manuscript');
await sleep(3000);
const tabs = await page.getByRole('tab').all();
for (const t of tabs) console.log('TAB', JSON.stringify(await t.innerText()));
await shot(page, 't9');
await ctx.close();
