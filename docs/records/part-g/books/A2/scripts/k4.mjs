import { open, shot, sleep, W } from './lib.mjs';
const rm = [['Isaura sent the Hush round again','Isaura Venn'],['Patience survived','Air-Warden of Patience'],['The Blank Share was Maren\'s name','Company\'s share']];
const add = [['Patience survived','Ama Ocampo']];
const { ctx, page } = await open({height: 1400});
await page.goto(W + '/knowledge');
await sleep(3000);
for (const [t,w] of rm) {
  await page.getByText(t, { exact: true }).first().click();
  await sleep(1200);
  const aside = page.locator('aside, [role=complementary]').last();
  const btns = await page.getByRole('button', { name: new RegExp('Remove.*' + w.replace(/'/g,".")) }).all();
  console.log(t, 'remove buttons', btns.length);
  if (btns.length) { await btns[0].click(); await sleep(800); }
}
for (const [t,w] of add) {
  await page.getByText(t, { exact: true }).first().click();
  await sleep(1200);
  const inp = page.getByLabel('Add a spoiler word'); await inp.fill(w); await inp.press('Enter'); await sleep(800);
}
await page.getByText('Patience survived', { exact: true }).first().click();
await sleep(1000);
await shot(page, 'k4');
await ctx.close();
