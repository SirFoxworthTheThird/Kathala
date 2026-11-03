import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
await page.getByRole('tab', { name: /^The Closing/ }).click(); await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Page', exact: true }).click(); await page.waitForTimeout(1200);
const tree = page.getByRole('tree').first();
await tree.getByText('Ch. 1 · Air on Credit', { exact: true }).click(); await page.waitForTimeout(1500);
console.log(await tree.innerText());
const items = await tree.getByRole('treeitem').evaluateAll(es => es.map(e => e.getAttribute('aria-label') + ' | ' + e.textContent.slice(0,40)));
console.log(items.slice(0,12));
await tree.getByText('The Bell', { exact: true }).first().click(); await page.waitForTimeout(1500);
for (let i=0;i<7;i++){ const t = await page.evaluate(() => { const s = window.getSelection(); const n = s.anchorNode; const el = n && (n.nodeType===1?n:n.parentElement); const line = el && el.closest('.cm-line'); return line ? line.className + ' :: ' + line.textContent.slice(0,80) : 'no line'; }); console.log(i, t); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200); }
await shot(page,'hdrdebug');
await ctx.close();
