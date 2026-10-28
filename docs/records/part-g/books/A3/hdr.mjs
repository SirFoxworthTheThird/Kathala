// node hdr.mjs edits.json : [{tab, chapter:"Ch. 1 · Air on Credit", scene:"The Bell", prefix:"Items:", line:"Items: ^The Mercy Bell:#The Dock Ring"}]
import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const edits = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { ctx, page } = await open();
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
let curTab = null;
for (const e of edits) {
  if (e.tab !== curTab) {
    await page.getByRole('tab', { name: new RegExp('^' + e.tab) }).click(); await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Page', exact: true }).click(); await page.waitForTimeout(1200);
    curTab = e.tab;
  }
  const tree = page.getByRole('tree').first();
  await tree.getByText(e.chapter, { exact: true }).click(); await page.waitForTimeout(1500);
  await tree.getByRole('treeitem', { name: e.scene, exact: true }).first().click().catch(async () => { await tree.getByText(e.scene, { exact: true }).first().click(); });
  await page.waitForTimeout(1500);
  let found = false, lastCharLine = false;
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150);
    const t = (await page.locator('.cm-activeLine').first().innerText().catch(() => '')).trim();
    if (t.startsWith(e.prefix)) { found = true; break; }
    if (t.startsWith('## ')) break;
  }
  if (found) {
    await page.keyboard.press('Home'); await page.keyboard.press('Shift+End');
    await page.keyboard.type(e.line);
  } else {
    // insert after the Characters: line
    await tree.getByRole('treeitem', { name: e.scene, exact: true }).first().click().catch(()=>{}); await page.waitForTimeout(1000);
    let ok = false;
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150);
      const t = (await page.locator('.cm-activeLine').first().innerText().catch(() => '')).trim();
      if (t.startsWith(e.after || 'Characters:')) { ok = true; break; }
    }
    if (!ok) { console.log('NOT FOUND', e.scene); continue; }
    await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type(e.line);
  }
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(2500);
  const note = (await page.locator('main').innerText()).match(/(Nothing in this world[^\n]*|not applied[^\n]*|isn't[^\n]*)/);
  console.log((found ? 'replaced' : 'inserted'), e.scene, note ? ' NOTE: ' + note[0] : '');
}
await page.waitForTimeout(2000);
await ctx.close();
