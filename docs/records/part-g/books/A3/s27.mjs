import { open, shot, URL, DIR } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/settings'); await page.waitForTimeout(2500);
const btn = page.getByRole('button', { name: /Export a \.pwk copy/ });
await btn.scrollIntoViewIfNeeded(); await btn.click(); await page.waitForTimeout(1500);
await shot(page, 'pwkdialog');
console.log(await page.locator('[role=dialog]').innerText().catch(()=>'no dialog'));
await ctx.close();
