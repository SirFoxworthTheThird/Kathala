import { open, shot, sleep, W } from './lib.mjs';
const spec = [
  ['The Clement carries a Sanitation Agent', 'Sanitation Agent, Pattern H, Hush'],
  ['Abel cut Lusine\'s clip on Hale\'s orders', 'jeweller\'s file'],
  ['The Hush lies under the black ridge', 'black ridge, forty-one metres'],
  ['The Concord came for Asset Seven', 'Asset Seven'],
  ['Isaura sent the Hush round again', 'sent round again'],
  ['Cato is a Directorate officer', 'Office of Supply'],
  ['Patience survived', 'Ama Ocampo'],
  ['The Strands descend from Corwin Hale', 'Edda Hale'],
  ['Hale sold Maren for the Purchase', 'one name'],
  ['Mags cut her own line', 'took it off me'],
  ['Abel took Maren\'s place on the Gull', 'green bottle'],
];
const { ctx, page } = await open({height: 1400});
await page.goto(W + '/knowledge');
await sleep(3000);
for (const [title, words] of spec) {
  await page.getByText(title, { exact: true }).first().click();
  await sleep(1000);
  const inp = page.getByLabel('Add a spoiler word');
  await inp.fill(words); await inp.press('Enter'); await sleep(800);
}
await ctx.close();
