await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/manuscript'); await page.waitForTimeout(2000);
await page.getByRole('button',{name:'Continuity Checker'}).click(); await page.waitForTimeout(6000);
const d = page.locator('[role=dialog]').last();
const t = await d.innerText();
fs.writeFileSync(DIR+'/cc.txt', t);
return t.slice(0,300);
