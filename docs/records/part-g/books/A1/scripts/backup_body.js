await page.goto('http://localhost:5211/#/'); await page.reload(); await page.waitForTimeout(2500);
await installCapture(page);
if (!(await page.getByRole('button',{name:'Single file', exact:true}).isVisible().catch(()=>false))) {
  await page.getByRole('button',{name:'More actions for What the Needle Keeps'}).click(); await page.waitForTimeout(700);
}
await page.getByRole('button',{name:'Single file', exact:true}).click();
const r = await takeCapture(page, DIR + '/backup.pwk');
await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/manuscript'); await page.waitForTimeout(1500);
return r;
