import { open, shot, BASE, sleep } from './lib.mjs';
const { ctx, page } = await open({height: 2000});
const W = BASE + '/#/worlds/qazoRpRKLPklIu-1YyQ3E';
await page.goto(W + '/settings');
await sleep(2500);
const sy = page.locator('#cal-start-year');
await sy.fill('2391'); await sy.press('Tab'); await sleep(800);
const wt = page.locator('#word-target'); await wt.fill('90000'); await wt.press('Tab'); await sleep(500);
const starts = [[2,10,2391],[12,5,2654],[3,3,2917]];
for (let i=0;i<3;i++){
  const day = page.getByLabel('Day', { exact: true }).nth(i);
  const mon = page.getByLabel('Month', { exact: true }).nth(i);
  const yr = page.getByLabel('Year', { exact: true }).nth(i);
  await yr.fill(String(starts[i][2])); await yr.press('Tab'); await sleep(500);
  await mon.selectOption(String(starts[i][1])); await sleep(500);
  await day.fill(String(starts[i][0])); await day.press('Tab'); await sleep(500);
}
await sleep(1000);
const els = await page.locator('input, select').all();
for (const e of els.slice(0,20)) console.log(await e.evaluate(n => `${n.tagName} aria=${n.getAttribute('aria-label')||''} id=${n.id} val=${n.value}`));
const t = await page.getByRole('main').innerText();
console.log(t.slice(t.indexOf('TIMELINES'), t.indexOf('TIMELINES')+600));
await ctx.close();
