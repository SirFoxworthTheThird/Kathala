await page.goto('http://localhost:5211/#/'); await page.reload(); await page.waitForTimeout(2000);
await page.evaluate(()=>{ window.showSaveFilePicker = undefined; });
if (!(await page.getByRole('button',{name:'Single file', exact:true}).isVisible().catch(()=>false))) {
  await page.getByRole('button',{name:'More actions for What the Needle Keeps'}).click(); await page.waitForTimeout(700);
}
const [dl] = await Promise.all([ page.waitForEvent('download', { timeout: 30000 }).catch(e => null), page.getByRole('button',{name:'Single file', exact:true}).click() ]);
if (!dl) return 'no download';
await dl.saveAs(DIR + '/backup.pwk');
const st = fs.statSync(DIR + '/backup.pwk');
await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/manuscript'); await page.waitForTimeout(1500);
return 'saved ' + dl.suggestedFilename() + ' ' + st.size + ' bytes';
