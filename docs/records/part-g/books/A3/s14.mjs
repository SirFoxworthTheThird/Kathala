import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/settings'); await page.waitForTimeout(2500);
await page.getByLabel('Era 2 label').fill('AC'); await page.getByLabel('Era 2 label').blur();
await page.waitForTimeout(800);
const html = await page.evaluate(() => { const s=[...document.querySelectorAll('*')].find(e=>e.textContent.trim()==='The Owing' && e.children.length===0); return s.closest('div').parentElement.outerHTML.slice(0,5000); });
console.log(html.replace(/class="[^"]*"/g,''));
await ctx.close();
