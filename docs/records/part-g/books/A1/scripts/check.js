const out=[];
await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/manuscript'); await page.waitForTimeout(2500);
await page.getByRole('treeitem').filter({ hasText: '· ' + MCH + ',' }).first().click(); await page.waitForTimeout(1500);
for (const t of TITLES) {
  await page.getByRole('treeitem').filter({ hasText: new RegExp('^' + t + '$') }).first().click(); await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: 'More about this scene' }).count() && !(await page.getByRole('button', { name: '+ Tag a thread…' }).count())) { await page.getByRole('button', { name: 'More about this scene' }).click(); await page.waitForTimeout(500); }
  const txt = await page.locator('main').innerText();
  const i = txt.indexOf('THIS SCENE'); const j = txt.indexOf('Character States', i);
  const seg = txt.slice(i, j);
  out.push(t + ' :: POV=' + (seg.match(/POINT OF VIEW\n([^\n]+)/)||[])[1] + ' | DESC=' + ((await page.getByLabel('Scene description').inputValue()).slice(0,30)) + ' | ' + seg.slice(seg.indexOf('PLOT THREADS')).replace(/\n/g,' / ').slice(0,300));
}
return out.join('\n');
