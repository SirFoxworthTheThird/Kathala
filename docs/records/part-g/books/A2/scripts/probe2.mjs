import { open, shot, BASE, sleep } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(BASE + '/#/worlds/qazoRpRKLPklIu-1YyQ3E/manuscript');
await sleep(2500);
const html = await page.evaluate(() => { const e = document.querySelector('[contenteditable=true]'); return e ? e.outerHTML.slice(0, 3000) + '\nCLASS ' + e.className + ' PARENT ' + e.parentElement.className : 'none'; });
console.log(html);
await ctx.close();
