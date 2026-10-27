import { open, shot, BASE, sleep } from './lib.mjs';
const { ctx, page } = await open({height: 3000});
const W = BASE + '/#/worlds/qazoRpRKLPklIu-1YyQ3E';
await page.goto(W + '/settings');
await sleep(2500);
console.log(await page.getByRole('main').innerText());
await shot(page, 's10-settings');
await ctx.close();
