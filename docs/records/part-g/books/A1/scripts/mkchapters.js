const chs = JSON.parse(fs.readFileSync(DIR+'/bible/chapters.json','utf8'));
const base = page.url().replace(/#\/worlds\/([^/]+)\/.*/, '#/worlds/$1/');
await page.goto(base+'manuscript'); await page.waitForTimeout(1500);
const out=[];
for (const [n, tl, title, syn] of chs) {
  if (n===1) continue;
  await page.getByRole('tab',{name:tl}).first().click(); await page.waitForTimeout(700);
  await page.getByRole('button',{name:'Add Chapter'}).first().click(); await page.waitForTimeout(600);
  const d=page.locator('[role=dialog]');
  await d.locator('#chapter-title').fill(title);
  await d.locator('#chapter-number').fill(String(n));
  await d.locator('#chapter-synopsis').fill(syn);
  await page.waitForTimeout(300);
  const note = await d.innerText();
  await d.getByRole('button',{name:'Add Chapter'}).click(); await page.waitForTimeout(900);
  out.push(n+' '+title+' :: '+note.split('\n').filter(l=>/number|become|free/i.test(l)).join(' / '));
}
return out.join('\n');
