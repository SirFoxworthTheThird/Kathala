import { open, shot, BASE, sleep } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(BASE);
await sleep(2000);
await shot(page, 's01-home');
console.log(await page.locator('body').innerText());
await ctx.close();
