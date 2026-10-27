// LEARN: [[fact, character, sceneFilter]]
const out=[];
await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/knowledge'); await page.reload(); await page.waitForTimeout(2500);
for (const [title, who, sc] of LEARN) {
  await page.locator('main').getByText(title,{exact:true}).first().click(); await page.waitForTimeout(1500);
  await page.getByText('Character…').last().click(); await page.waitForTimeout(500);
  await page.getByRole('option',{name:who, exact:true}).first().click(); await page.waitForTimeout(400);
  await page.getByText('Learns it at…').last().click(); await page.waitForTimeout(500);
  const f = page.getByPlaceholder(/Filter scenes/);
  if (await f.count()) { await f.last().fill(sc); await page.waitForTimeout(400); }
  await page.getByRole('option',{name:new RegExp(sc)}).first().click(); await page.waitForTimeout(400);
  await page.getByRole('button',{name:/Record who learns it/}).click(); await page.waitForTimeout(800);
  out.push(title+' / '+who+' ok');
}
return out.join('\n');
