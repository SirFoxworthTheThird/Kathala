import { open, shot, URL, DIR } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/'); await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'More actions for What the Dark Is Owed' }).click(); await page.waitForTimeout(800);
console.log(await page.locator('[role=menu]').innerText().catch(()=>'nomenu'));
await shot(page, 'cardmenu');
await ctx.close();
