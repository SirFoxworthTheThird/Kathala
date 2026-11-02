import { open, shot, sleep, W } from './lib.mjs';
import fs from 'fs';
const titles = JSON.parse(fs.readFileSync('bible/knowledge.json','utf8')).knowledge.map(k=>k.title);
const { ctx, page } = await open({height: 1400});
await page.goto(W + '/knowledge');
await sleep(3000);
for (const t of titles) {
  const card = page.getByText(t, { exact: true }).first();
  if (!(await card.count())) { console.log('missing', t); continue; }
  await card.click(); await sleep(800);
  await page.getByRole('button', { name: /Delete Fact/ }).click(); await sleep(600);
  const conf = page.getByRole('dialog').getByRole('button', { name: /Delete/ });
  if (await conf.count()) { await conf.last().click(); await sleep(600); }
  console.log('deleted', t);
}
await ctx.close();
