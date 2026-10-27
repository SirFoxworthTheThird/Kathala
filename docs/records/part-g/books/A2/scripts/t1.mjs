import { open, shot, sleep, pasteText, W } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(W + '/manuscript');
await sleep(3000);
await page.getByRole('tab', { name: /The Bonded/ }).first().click().catch(async()=>{await page.getByText('The Bonded',{exact:true}).first().click();});
await sleep(1500);
await page.getByRole('button', { name: /^Page$/ }).click().catch(()=>{});
await sleep(1500);
const ed = page.locator('.cm-content');
// select the header block
const hdrStart = page.locator('.cm-draft-header-start').first();
await hdrStart.click();
await page.keyboard.press('Home');
await page.keyboard.down('Shift');
for (let i=0;i<2;i++) await page.keyboard.press('ArrowDown');
await page.keyboard.press('End');
await page.keyboard.up('Shift');
await sleep(300);
const header = `[
  Place: #The tether deck
  Characters: @@Maren Tsolo @@Lusine Arda:dead @@Odile Arda @@Abel Tsolo
  Items: ^Maren's hook-knife:@Maren Tsolo ^Tether-chief's coat:@Maren Tsolo
  When: 2 November 2391
]`;
await pasteText(page, header);
await sleep(1500);
// move off: arrow down to the next line
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await sleep(2500);
console.log(await ed.innerText());
console.log('---NOTICES---');
console.log((await page.getByRole('main').innerText()).slice(0, 1500));
await shot(page, 't1');
await ctx.close();
