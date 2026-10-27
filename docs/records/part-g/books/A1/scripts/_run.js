const EDITS=[["*The door grew narrow in the dark,\nthe Reach was cold and small,\nthe First Warden heard it hunger\nand the Reach gave of its all.*", "  *The door grew narrow in the dark,\n  the Reach was cold and small,\n  the First Warden heard it hunger\n  and the Reach gave of its all.*"], ["*They loaded glass in little ships\nand flew them through the night,\nand what the Needle keeps, it keeps,\nand in the morning, light.*", "  *They loaded glass in little ships\n  and flew them through the night,\n  and what the Needle keeps, it keeps,\n  and in the morning, light.*"]];
// global EDITS: [[old,new],...]
if (!page.url().includes('/manuscript')) { await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/manuscript'); await page.waitForTimeout(3000); }
if ((await page.getByRole('tab',{name:'All timelines'}).getAttribute('aria-selected')) !== 'true') { await page.getByRole('tab',{name:'All timelines'}).click(); await page.waitForTimeout(1000); }
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
if ((await page.getByRole('button',{name:'Page', exact:true}).getAttribute('aria-pressed')) !== 'true') { await page.getByRole('button',{name:'Page', exact:true}).click(); await page.waitForTimeout(1500); }
const res = [];
for (const [OLD, NEW] of EDITS) {
  let found; for (let tries=0; tries<4; tries++) { try { await page.waitForSelector('.cm-content'); found = await page.evaluate((old) => {
    const v = document.querySelector('.cm-content').cmTile.view;
    const doc = v.state.doc.toString();
    const i = doc.indexOf(old);
    if (i < 0) return -1;
    if (doc.indexOf(old, i + 1) >= 0) return -2;
    v.focus();
    v.dispatch({ selection: { anchor: i, head: i + old.length }, scrollIntoView: true });
    return i;
  }, OLD); break; } catch (e) { await page.waitForTimeout(2500); } }
  if (found === undefined) { res.push('ERR ' + OLD.slice(0,50)); continue; }
  if (found < 0) { res.push((found===-1?'NOTFOUND ':'NOTUNIQUE ') + OLD.slice(0, 60)); continue; }
  await page.waitForTimeout(400);
  await page.evaluate((t) => navigator.clipboard.writeText(t), NEW);
  await page.keyboard.press('Control+v'); await page.waitForTimeout(1500);
  let ok=false; for (let t=0;t<4;t++){ try { await page.waitForSelector('.cm-content'); ok = await page.evaluate((n) => document.querySelector('.cm-content').cmTile.view.state.doc.toString().includes(n), NEW); break; } catch(e) { await page.waitForTimeout(2500); } }
  res.push((ok ? 'ok ' : 'FAIL ') + NEW.slice(0, 50).replace(/\n/g, ' '));
}
await page.waitForTimeout(2000);
return res.join('\n');
