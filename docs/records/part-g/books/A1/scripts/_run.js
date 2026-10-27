const META = [
 {t:'Wire', pov:'Isra Venn', ten:2, d:'Isra sells Compact resonator wire to Brother Lucan at the half-dead Anchor. The shard is silent at the harp\'s Hunger Tone. Lucan shows her the Bell, an ancient dead buoy at the mouth.', th:['Isra and the Gristle crew','The choked throat'], mo:["The fork's note"]},
 {t:'The Lamplighter at the Anchor', pov:'Lucan Aske', ten:3, d:'The Lamplighter lays her hand on the harp and says her son\'s name. Lucan tells her the Needle is dying; she says it is hungry. The Prior yields.', th:['The Great Keeping','The Keeping (all eras)'], mo:['Light in the dark','Hands']},
 {t:'Levy', pov:'Isra Venn', ten:4, d:'The Lantern levies glass in the Gutter and takes Pike\'s inhaler; Hanne faces down Rusk. Pike confesses: at the Fifty-Ninth a Keeper turned back and Rusk had him fired on.', th:['The Great Keeping','Isra and the Gristle crew'], mo:['Salt and glass','Hands']},
];
// global META: [{t:title, pov, ten, d, th:[], mo:[], st}]
const out = [];
await page.keyboard.press('Escape');
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
