const base = page.url().replace(/#\/worlds\/([^/]+)\/.*/, '#/worlds/$1/');
const out = [];
for (const [sec, file] of [['items','items'],['maps','places'],['lore','lore'],['factions','factions']]) {
  await page.goto(base + sec); await page.waitForTimeout(1500);
  await page.getByRole('button',{name:/Generate with AI|Generate locations/}).first().click(); await page.waitForTimeout(1000);
  const d = page.locator('[role=dialog]');
  await d.locator('textarea').last().fill(fs.readFileSync(DIR+'/bible/'+file+'.json','utf8'));
  await page.waitForTimeout(1000);
  const t = await d.innerText();
  out.push(sec+': '+t.slice(t.indexOf('Paste the AI')));
  const btn = d.getByRole('button',{name:/^(Add|Import|Create)/}).last();
  out.push('  btn: '+(await btn.innerText()));
  await btn.click(); await page.waitForTimeout(2000);
  out.push('  after: '+(await page.locator('main').innerText()).slice(0,200).replace(/\n/g,' | '));
}
return out.join('\n');
