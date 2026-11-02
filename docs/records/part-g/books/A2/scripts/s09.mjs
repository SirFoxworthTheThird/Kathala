import { open, shot, BASE, sleep } from './lib.mjs';
const { ctx, page } = await open();
const W = BASE + '/#/worlds/qazoRpRKLPklIu-1YyQ3E';
await page.goto(W + '/manuscript');
await sleep(2500);
for (const name of ['The Siege', 'The Last Return']) {
  await page.getByRole('button', { name: 'New Timeline' }).click();
  await sleep(800);
  const d = page.getByRole('dialog');
  console.log(await d.innerText());
  await d.locator('input').first().fill(name);
  await sleep(300);
  await d.getByRole('button', { name: /Create|Add|New/ }).last().click();
  await sleep(1500);
}
await shot(page, 's09-timelines');
console.log((await page.getByRole('main').innerText()).slice(0,1500));
await ctx.close();
