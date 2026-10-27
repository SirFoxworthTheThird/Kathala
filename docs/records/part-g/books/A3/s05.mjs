import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw'); await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Go to my Manuscript' }).click().catch(()=>{});
await page.waitForTimeout(1500);
await shot(page, 'manuscript0');
console.log(page.url());
console.log((await page.locator('main').innerText()).slice(0,3000));
await ctx.close();
