import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL); await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'New World' }).first().click();
await page.waitForTimeout(800);
await shot(page, 'newworld');
console.log(await page.locator('[role=dialog]').innerText());
await ctx.close();
