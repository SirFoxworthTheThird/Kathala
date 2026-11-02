const chs = JSON.parse(fs.readFileSync(DIR+'/bible/chapters.json','utf8')).map(c=>c[2]);
await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/manuscript'); await page.waitForTimeout(3000);
let n=0; const errs=[];
for (const ch of chs) {
  await page.getByRole('treeitem').filter({ hasText: '· ' + ch + ',' }).first().click(); await page.waitForTimeout(1500);
  const scenes = await page.evaluate((ch)=>{ const items=[...document.querySelectorAll('[role=treeitem]')]; const i=items.findIndex(e=>e.textContent.includes('· '+ch+',')); const out=[]; for (let j=i+1;j<items.length;j++){ const t=items[j].textContent; if (/^Ch\. \d+ ·/.test(t)) break; out.push(t.trim()); } return out; }, ch);
  for (const t of scenes) {
    try {
      await page.getByRole('treeitem').filter({ hasText: new RegExp('^' + t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$') }).first().click(); await page.waitForTimeout(900);
      await page.locator('button').filter({ hasText: /^Revised$/ }).last().click(); await page.waitForTimeout(300); n++;
    } catch(e) { errs.push(ch+'/'+t); }
  }
}
return n + ' set; errors: ' + errs.join('; ');
