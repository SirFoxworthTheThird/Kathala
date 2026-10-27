import { open, shot, BASE, sleep } from './lib.mjs';
const { ctx, page } = await open();
const W = BASE + '/#/worlds/qazoRpRKLPklIu-1YyQ3E';
for (const r of ['/items', '/factions', '/lore', '/knowledge', '/relationships', '/maps']) {
  await page.goto(W + r);
  await sleep(2500);
  const b = page.getByRole('button', { name: /Generate with AI/ });
  console.log('=====', r, await b.count());
  if (await b.count() === 0) { console.log((await page.getByRole('main').innerText()).slice(0,800)); continue; }
  await b.first().click();
  await sleep(1000);
  const pre = page.getByRole('dialog').locator('pre');
  if (await pre.count()) console.log(await pre.first().textContent());
  await page.keyboard.press('Escape');
}
await ctx.close();
