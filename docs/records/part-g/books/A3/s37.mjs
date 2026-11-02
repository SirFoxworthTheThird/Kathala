import { open, shot, URL } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/factions'); await page.waitForTimeout(2500);
const F = {
 'The Halden-Ash Company': ['The Closing, 2387. The chartered company that opened the Sabra Concern in 2296 and owns Lantern, its air, its water, and its people\'s contracts. Withdrawing as the Throat closes.', ['Ruth Achterberg','Teodor Basu']],
 'The Speakers': ['The Closing, 2387. The elected voices of Lantern\'s indentured crews: Wick, pumps, stills, farms, docks. Not a union the Company recognises.', ['Dagny Ostrova','Joss Teague']],
 'Company Security': ['The Closing, 2387. The Company\'s armed men on Lantern, ex-marines most of them. They sealed Caul Deep.', ['Hale Varga']],
 'The Count': ['The Owing, 311 AC. The Counting House: the counting families of the Upper Wards who keep the Tally and administer the Caul Account. Ruled by the Comptroller-General; enforced by the Bailiff of the Count.', ['Imre Vosk','Orrin Sallow','Brother Lusk']],
 'The Salt': ['The Owing, 311 AC. Smugglers who run ice off Caul outside the Tally and trade in brass washers. Based in the old ice docks.', ['Wenna Blackwood']],
 'The Wickwrights': ['The Owing, 311 AC. The guild that keeps the Wick. Down to a handful.', ['Ninian']],
 'Brightwater Recovery': ['The Healing, 3089 CE. A Concord lien-house. Bought the Halden-Ash Sabra Concern receivables eleven years before the Throat healed.', ['Quennell Haste','Corvin Saal','Idris Kell']],
 "The Good Title's crew": ['The Healing, 3089 CE. Mabry Ode\'s people. Throat-runners.', ['Mabry Ode','Tol Brask']],
};
const side = page.locator('main').locator('div').filter({ has: page.getByText('MEMBERS', { exact: false }) }).last();
for (const [name, [desc, members]] of Object.entries(F)) {
  await page.locator('main').getByText(name, { exact: true }).first().click(); await page.waitForTimeout(800);
  const ta = page.locator('main textarea').first(); await ta.fill(desc); await ta.blur(); await page.waitForTimeout(400);
  for (const m of members) {
    if (!(await page.getByRole('button', { name: /Choose character/ }).count())) { await page.getByRole('button', { name: 'Add member' }).click(); await page.waitForTimeout(500); }
    await page.getByRole('button', { name: /Choose character/ }).click(); await page.waitForTimeout(400);
    await page.getByRole('option', { name: m, exact: true }).click(); await page.waitForTimeout(600);
  }
}
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/factions'); await page.waitForTimeout(1500);
console.log(await page.locator('main').innerText());
await ctx.close();
