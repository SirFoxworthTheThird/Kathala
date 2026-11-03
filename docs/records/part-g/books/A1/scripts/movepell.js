const out=[];
for (const title of ['The Narrowing passes on its own','The High Wardens inherit the lie']) {
  await page.locator('main').getByText(title,{exact:true}).first().click(); await page.waitForTimeout(1500);
  await page.getByRole('button',{name:'Pell Asante does not know this'}).click(); await page.waitForTimeout(800);
  // record Pell learns at The Mouth
  await page.getByRole('button',{name:/^Character…$/}).last().click().catch(async()=>{ await page.getByText('Character…').last().click(); });
  await page.waitForTimeout(500);
  await page.getByRole('option',{name:'Pell Asante', exact:true}).first().click(); await page.waitForTimeout(400);
  await page.getByText('Learns it at…').last().click(); await page.waitForTimeout(500);
  const f = page.getByPlaceholder(/Filter scenes/);
  if (await f.count()) { await f.last().fill('The Mouth'); await page.waitForTimeout(400); }
  await page.getByRole('option',{name:/The Mouth/}).first().click(); await page.waitForTimeout(400);
  await page.getByRole('button',{name:/Record who learns it/}).click(); await page.waitForTimeout(800);
  const t = await page.locator('body').innerText();
  const i = t.indexOf('KNOWN BY'); out.push(title+': '+t.slice(i, i+400).replace(/\n/g,' | '));
}
return out.join('\n');
