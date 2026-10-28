// node hdr.mjs edits.json : [{tab, chapter, scene, prefix:"Items:", line:"Items: ...", after:"Characters:"}]
import { open, shot, URL } from './lib.mjs';
import fs from 'fs';
const edits = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { ctx, page } = await open();
page.setDefaultTimeout(8000);
await page.goto(URL + '/#/worlds/p5RB-gewXUZYlHUKTH5pw/manuscript'); await page.waitForTimeout(2500);
const lineText = () => page.evaluate(() => { const s = window.getSelection(); const n = s.focusNode; const el = n && (n.nodeType === 1 ? n : n.parentElement); const line = el && el.closest('.cm-line'); return line ? line.textContent : ''; });
let curTab = null;
for (const e of edits) {
  try {
    if (e.tab !== curTab) {
      await page.getByRole('tab', { name: new RegExp('^' + e.tab) }).click(); await page.waitForTimeout(2500);
      await page.getByRole('button', { name: 'Page', exact: true }).click(); await page.waitForTimeout(1200);
      curTab = e.tab;
    }
    const tree = page.getByRole('tree').first();
    if (!(await tree.getByText(e.scene, { exact: true }).count())) { await tree.getByText(e.chapter, { exact: true }).click(); await page.waitForTimeout(1500); }
    await tree.getByText(e.scene, { exact: true }).first().click(); await page.waitForTimeout(1500);
    let found = false, anchor = false;
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('ArrowUp'); await page.waitForTimeout(120);
      const t = (await lineText()).trim();
      if (t.startsWith(e.prefix)) { found = true; break; }
      if (!anchor && t.startsWith(e.after || 'Characters:')) anchor = true;
      if (t.startsWith('[')) break;
    }
    if (found) {
      await page.keyboard.press('End'); await page.keyboard.press('Shift+Home');
      const sel = await page.evaluate(() => window.getSelection().toString());
      await page.keyboard.type(sel.startsWith(' ') ? '  ' + e.line : e.line);
    } else {
      // go back to the scene and up to the anchor line, then insert after it
      await tree.getByText(e.scene, { exact: true }).first().click(); await page.waitForTimeout(1200);
      let ok = false;
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press('ArrowUp'); await page.waitForTimeout(120);
        if ((await lineText()).trim().startsWith(e.after || 'Characters:')) { ok = true; break; }
      }
      if (!ok) { console.log('NOT FOUND', e.scene); continue; }
      await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type(e.line);
    }
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(2500);
    const notes = (await page.locator('main').innerText()).split('\n').filter(l => /not applied|Nothing in this world|answers to|wait as typed/i.test(l));
    console.log((found ? 'replaced' : 'inserted'), e.scene, notes.length ? ' NOTE: ' + notes.join(' / ') : '');
  } catch (err) { console.log('FAIL', e.scene, err.message.split('\n')[0]); }
}
await page.waitForTimeout(2000);
await ctx.close();
