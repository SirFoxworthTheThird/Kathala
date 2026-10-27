const MCH="The Thirtieth Keeping";
const META = [
 {t:'Line of Battle', pov:'Juno Asante', ten:4, d:'The Vigil and nineteen League ships ride the shear down to the Anchorhold. Greaves threatens to fire on anyone near the barge. Rhee\'s line holds the Home Squadron. Dock Four.', th:['The Severance war',"Adaeze's heresy"], mo:[]},
 {t:'Broadcast', pov:'Adaeze Quill', ten:5, d:'Mor lets her read. Adaeze tunes the harp true on every channel and reads the Testament. The guard-captain shoots her as she breaks the seal; Mor reads the name for her — Hesper Vane — and the fork was Ambrose Lyle\'s, for Clare. Then he bars himself in the archive and burns it.', th:["Adaeze's heresy",'The Keeping (all eras)'], mo:["The fork's note",'Light in the dark']},
 {t:'The Mouth', pov:'Juno Asante', ten:5, d:'At the barge Pell hears the harp breathing: it is not asking for anything. She turns round: I don\'t want to. The Ardour\'s guns swing; Juno puts the Vigil between; Pryce will not fire. Six turn back, three go on.', th:["Pell's Draw",'The Keeping (all eras)'], mo:['Light in the dark']},
 {t:"The Founders' Tally", pov:'Juno Asante', ten:3, d:'The door opens on schedule; the Reach argues. At night in the Compact Hall the sisters read the bottom of the Tally by lamplight: C. DACE — PILOT, A. LYLE — HARP, T. KESH — PILOT, FOR CLARE. Not Keeper. Pell adds A. QUILL — ARCHIVIST.', th:["Pell's Draw","Adaeze's heresy"], mo:['Debt and the tally','Hands']},
];
// global META: [{t:title, pov, ten, d, th:[], mo:[], st}]
const out = [];
await page.keyboard.press('Escape');
if (!page.url().includes('/manuscript')) { await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/manuscript'); await page.waitForTimeout(2500); }
if (typeof MCH !== 'undefined') { await page.getByRole('treeitem').filter({ hasText: '· ' + MCH + ',' }).first().click(); await page.waitForTimeout(1500); }
for (const m of META) {
  await page.getByRole('treeitem').filter({ hasText: new RegExp('^' + m.t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
  await page.waitForTimeout(1200);
  const panelBtn = (name) => page.locator('button').filter({ hasText: new RegExp('^' + name + '$') }).last();
  if (m.st) { await panelBtn(m.st).click(); await page.waitForTimeout(300); }
  if (m.ten) { await panelBtn(String(m.ten)).click(); await page.waitForTimeout(300); }
  if (m.pov) {
    const povBtn = page.locator('button').filter({ hasText: /^(No POV character|Teo Kesh|Ambrose Lyle|Juno Asante|Pell Asante|Adaeze Quill|Isra Venn|Lucan Aske|Nico Kesh|Hesper Vane|Hanne Venn|Ostap Pike|Mercy Oduya|Cassius Mor|Efua Asante|Corrigan Dace|Bettany Shore|Salome Okafor)$/ }).first();
    await povBtn.click(); await page.waitForTimeout(400);
    await page.getByRole('option', { name: m.pov, exact: true }).first().click(); await page.waitForTimeout(400);
  }
  if (m.d) { const ta = page.getByLabel('Scene description'); await ta.fill(m.d); await page.waitForTimeout(1500); await ta.press('Tab'); await page.waitForTimeout(600); }
  const more = page.getByRole('button', { name: 'More about this scene' });
  if ((m.th && m.th.length) || (m.mo && m.mo.length)) {
    if (!(await page.getByRole('button', { name: '+ Tag a thread…' }).count())) { await more.click(); await page.waitForTimeout(500); }
    for (const th of m.th || []) {
      await page.getByRole('button', { name: '+ Tag a thread…' }).click(); await page.waitForTimeout(400);
      await page.getByRole('option', { name: th, exact: true }).first().click(); await page.waitForTimeout(400);
    }
    for (const mo of m.mo || []) {
      await page.getByRole('button', { name: '+ Tag a motif…' }).click(); await page.waitForTimeout(400);
      await page.getByRole('option', { name: mo, exact: true }).first().click(); await page.waitForTimeout(400);
    }
  }
  out.push(m.t + ' ok');
}
return out.join('\n');
