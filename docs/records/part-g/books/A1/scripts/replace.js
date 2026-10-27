// globals: OLD (exact text in the page doc), NEW (replacement). Selects OLD via the editor selection, then pastes NEW.
if (!page.url().includes('/manuscript')) { await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/manuscript'); await page.waitForTimeout(2500); }
const found = await page.evaluate((old) => {
  const v = document.querySelector('.cm-content').cmTile.view;
  const doc = v.state.doc.toString();
  const i = doc.indexOf(old);
  if (i < 0) return { i: -1 };
  if (doc.indexOf(old, i + 1) >= 0) return { i: -2 };
  v.focus();
  v.dispatch({ selection: { anchor: i, head: i + old.length }, scrollIntoView: true });
  return { i };
}, OLD);
if (found.i === -1) return 'OLD not found';
if (found.i === -2) return 'OLD not unique';
await page.waitForTimeout(600);
await page.evaluate((t) => navigator.clipboard.writeText(t), NEW);
await page.keyboard.press('Control+v'); await page.waitForTimeout(2500);
const ok = await page.evaluate((n) => document.querySelector('.cm-content').cmTile.view.state.doc.toString().includes(n), NEW);
return 'pasted at ' + found.i + '; present now: ' + ok;
