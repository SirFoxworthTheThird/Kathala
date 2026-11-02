import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/knowledge'); await page.waitForTimeout(2500);
await page.getByText("The Tally keys Lantern's air to each person's debt").first().click(); await page.waitForTimeout(1000);
await page.getByRole('button', { name: /Auto — when a POV/ }).click(); await page.waitForTimeout(800);
await shot(page, 'readerlearns');
console.log(await page.locator('[role=listbox], [role=dialog], [role=menu]').first().innerText().catch(()=> 'none'));
console.log((await page.locator('[role=option]').allInnerTexts()).slice(0,20));
await ctx.close();
