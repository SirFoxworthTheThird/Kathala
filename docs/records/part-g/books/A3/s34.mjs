import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/factions'); await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'New Faction' }).click(); await page.waitForTimeout(800);
console.log(await page.locator('[role=dialog]').innerText().catch(()=>'nodialog'));
console.log(await page.locator('main').innerText());
await shot(page, 'faction');
await ctx.close();
