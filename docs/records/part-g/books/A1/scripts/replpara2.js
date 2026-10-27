// globals: CHAP, NEXT (title of scene after the paragraph's scene), UPS (ArrowUp presses), START, NEW
if (!page.url().includes('/manuscript')) { await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/manuscript'); await page.waitForTimeout(2500); }
await page.getByRole('treeitem').filter({ hasText: '· ' + CHAP + ',' }).first().click(); await page.waitForTimeout(1200);
await page.getByRole('treeitem').filter({ hasText: new RegExp('^' + NEXT + '$') }).first().click(); await page.waitForTimeout(1800);
const out = [];
for (let i = 0; i < UPS; i++) {
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(120);
  const txt = await page.evaluate(() => { const s = window.getSelection(); const n = s.anchorNode; const el = n && (n.nodeType === 3 ? n.parentElement : n); const l = el && el.closest('.cm-line'); return l ? l.textContent : ''; });
  if (txt.startsWith(START)) {
    await page.keyboard.press('Control+l'); await page.waitForTimeout(300);
    const sel = await page.evaluate(() => window.getSelection().toString());
    if (!sel.startsWith(START)) return 'selection mismatch: [' + sel.slice(0, 100) + ']';
    if (typeof DRY !== 'undefined') return 'dry: selected ' + sel.length + ' ends with ' + JSON.stringify(sel.slice(-30));
    await page.evaluate((t) => navigator.clipboard.writeText(t), NEW);
    await page.keyboard.press('Control+v'); await page.waitForTimeout(2500);
    return 'replaced ' + sel.length + ' chars after ' + (i + 1) + ' ups';
  }
}
return 'not reached';
