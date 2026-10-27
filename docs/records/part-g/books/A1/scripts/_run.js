const MCH="The Long Night";
const META = [
 {t:'The Cells', pov:'Teo Kesh', ten:4, d:'Teo visits Nico in chains. She is not going in to feed it. She gives him the Director\'s bead and keeps his. Remember the breath.', th:["Teo's debt","The Cutters' strike"], mo:['Debt and the tally','Hands']},
 {t:'The Blessing', pov:'Teo Kesh', ten:4, d:'Nine tugs on Dock Four. Salome blesses the pilots by name with her hand on their faces; Lulu gives Teo a bolt for luck. The spool is sealed in the flight recorder. The plan: through the waist to Ardent.', th:['The Keeping (all eras)'], mo:['Hands']},
 {t:'The Keeping', pov:'Teo Kesh', ten:5, d:'The fork is struck as the Keepers go in. In the folded light Teo records her log. The eight release and turn; she does not. Turning into the wave, she goes on into the iris and the light.', th:['The Keeping (all eras)',"Ambrose's proof"], mo:['Light in the dark',"The fork's note",'Salt and glass']},
 {t:'The Hunger Tone', pov:'Bettany Shore', ten:5, d:'The waist turns on its own, eleven minutes off Ambrose\'s prediction. The Mercy did not come out. Hesper has Bettany strike the fork, then orders the harp tuned to the Hunger Tone, the old records taken, and makes herself First Warden. For clarity.', th:['The Keeping (all eras)','The Withdrawal'], mo:["The fork's note"]},
 {t:'Pilot', pov:'Nico Kesh', ten:4, d:'Nico walks free onto the Pans as the crowds sing that the Keeping worked. At the shaft-head he scratches T. KESH — PILOT on the Tally, and says her name aloud.', th:["The Cutters' strike",'The Keeping (all eras)'], mo:['Debt and the tally']},
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
