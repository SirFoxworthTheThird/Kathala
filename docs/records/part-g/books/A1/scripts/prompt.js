const base = page.url().replace(/#\/worlds\/([^/]+)\/.*/, '#/worlds/$1/');
const out = [];
for (const sec of ['items','maps','lore','factions','knowledge']) {
  await page.goto(base + sec); await page.waitForTimeout(1500);
  const b = page.getByRole('button',{name:/Generate with AI|Generate locations/}).first();
  if (!(await b.count())) { out.push(sec+': no button; '+(await page.locator('main').innerText()).slice(0,300)); continue; }
  await b.click(); await page.waitForTimeout(1000);
  const d = page.locator('[role=dialog]');
  const t = await d.innerText();
  out.push('=== '+sec+'\n'+t.slice(t.indexOf('SHAPE'), t.indexOf('Paste the AI')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
}
return out.join('\n');
