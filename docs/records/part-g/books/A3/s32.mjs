import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/knowledge'); await page.waitForTimeout(2500);
await page.getByText("The Tally keys Lantern's air to each person's debt").first().click(); await page.waitForTimeout(1000);
const m = page.locator('main');
const els = await m.locator('select, input, textarea, button[aria-haspopup], [role=combobox]').evaluateAll(es => es.map(e => e.tagName + ' id=' + e.id + ' aria=' + (e.getAttribute('aria-label')||'') + ' lblby=' + (e.getAttribute('aria-labelledby')||'') + ' ph=' + (e.placeholder||'') + ' txt=' + e.textContent.slice(0,60)));
console.log(els.join('\n'));
await ctx.close();
