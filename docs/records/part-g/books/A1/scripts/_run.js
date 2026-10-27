const META = [
 {t:'The Ossuary', pov:'Isra Venn', ten:2, d:'Isra and Pike cut a Keeper\'s skiff in the Ossuary; its glass grows backwards, layered like a cliff, as if the ship were pushed.', th:['Isra and the Gristle crew','The choked throat'], mo:['Salt and glass','Hands']},
 {t:'The Lantern Comes', pov:'Isra Venn', ten:3, d:'Deacon Rusk takes the Return and the hold. The Lamplighter proclaims a Great Keeping: a hundred Keepers, all glass is tithe.', th:['The Great Keeping','The Keeping (all eras)'], mo:['Light in the dark']},
 {t:'Hanne', pov:'Isra Venn', ten:2, d:'Hanne sings the Long Night and tells what a teller knows. The banded glass hums back at the cittern\'s low string.', th:['Isra and the Gristle crew','The choked throat'], mo:["The fork's note",'Salt and glass']},
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
