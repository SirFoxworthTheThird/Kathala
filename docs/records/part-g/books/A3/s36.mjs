import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/factions'); await page.waitForTimeout(2500);
await page.getByText('The Halden-Ash Company').first().click(); await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Add member' }).click(); await page.waitForTimeout(800);
await shot(page, 'addmember');
console.log(await page.locator('[role=dialog]').innerText().catch(()=> 'nodialog'));
console.log(await page.locator('main').locator('select, input, button[aria-haspopup]').evaluateAll(es => es.map(e => e.tagName + ' ' + (e.getAttribute('aria-label')||'') + ' ph=' + (e.placeholder||'') + ' ' + e.textContent.slice(0,40))));
await ctx.close();
