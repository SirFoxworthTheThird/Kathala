const R = { "The Founder's Fork was Ambrose's": ['not','For Clare'], 'Hesper Vane was the First Warden': ['Hesper Vane','First Warden'] };
const out=[];
await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/knowledge'); await page.reload(); await page.waitForTimeout(2500);
for (const [title, words] of Object.entries(R)) {
  await page.locator('main h3, main [class*=font]').filter({hasText: new RegExp('^'+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).first().click(); await page.waitForTimeout(1500);
  const cur = await page.getByLabel('Spoiler words').innerText().catch(()=>'?');
  for (const w of words) { const b = page.getByRole('button',{name:'Remove “'+w+'”'}); if (await b.count()) { await b.first().click(); await page.waitForTimeout(400);} }
  out.push(title+': before ['+cur.replace(/\n/g,', ')+'] after ['+(await page.getByLabel('Spoiler words').innerText().catch(()=>'?')).replace(/\n/g,', ')+']');
}
return out.join('\n');
