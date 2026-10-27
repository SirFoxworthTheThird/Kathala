const MCH="Ashes in the Gutter";
const META = [
 {t:'Hoarders', pov:'Isra Venn', ten:5, d:'The Lamplighter\'s Cleansing sets the Gutter alight. Isra and Pike drag Hanne out; dying, she tells Isra the cittern\'s low string has never been retuned — the tellers\' old note.', th:['The Great Keeping','Isra and the Gristle crew'], mo:["The fork's note",'Light in the dark']},
 {t:'The Old Note', pov:'Isra Venn', ten:3, d:'Hanne lies in the harp hall. Lucan, who stole the Fork back, strikes it against the cittern\'s low string: the same note. The tellers kept it through the Quiet.', th:['The choked throat','Isra and the Gristle crew'], mo:["The fork's note"]},
 {t:"The Lamplighter's Chapel", pov:'Lucan Aske', ten:4, d:'The Lamplighter takes the Anchor and kneels at Hanne\'s body: Hanne sang at Tobin\'s naming. She asks Lucan to read the line on her ship. He says yes.', th:['The Great Keeping','The Keeping (all eras)'], mo:['Hands','Light in the dark']},
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
