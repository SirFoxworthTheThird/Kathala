import { open, shot, BASE, sleep } from './lib.mjs';
const url = process.argv[2] || '';
const { ctx, page } = await open();
await page.goto(BASE + url);
await sleep(2500);
await shot(page, 'probe');
const els = await page.locator('input, textarea, [contenteditable=true], select').all();
for (const e of els) {
  console.log(await e.evaluate(n => `${n.tagName} id=${n.id} name=${n.name||''} ph=${n.placeholder||''} aria=${n.getAttribute('aria-label')||''} type=${n.type||''}`));
}
await ctx.close();
