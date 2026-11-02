// node splitpara.mjs '[["text before", "text after"], ...]'  — turns "before  after" (two spaces) into two paragraphs
import { open, URL } from './lib.mjs';
const pairs = JSON.parse(process.argv[2]);
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
await page.getByRole('tab', { name: /^All timelines/ }).click(); await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Page', exact: true }).click(); await page.waitForTimeout(1500);
for (const [a, b] of pairs) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+f'); await page.waitForTimeout(400);
  await page.keyboard.press('Control+a'); await page.keyboard.type(a + '  ' + b.slice(0, 12)); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  const sel = await page.evaluate(() => window.getSelection().toString());
  if (!sel.startsWith(a)) { console.log('selection mismatch:', JSON.stringify(sel.slice(0, 60))); continue; }
  await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < a.length; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Delete'); await page.keyboard.press('Delete');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  console.log('split at', JSON.stringify(a.slice(-30)));
}
await page.waitForTimeout(2500);
await ctx.close();
