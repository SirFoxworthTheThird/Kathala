import { open, shot, URL, DIR } from './lib.mjs';
const { ctx, page } = await open();
await ctx.addInitScript(() => { try { delete window.showSaveFilePicker; window.showSaveFilePicker = undefined; } catch {} });
await page.goto(URL + '/#/'); await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'More actions for What the Dark Is Owed' }).click(); await page.waitForTimeout(800);
const [dl] = await Promise.all([ page.waitForEvent('download', { timeout: 30000 }), page.getByText('Single file', { exact: true }).click() ]);
await dl.saveAs(DIR + '/backup.pwk');
console.log('saved', dl.suggestedFilename());
await ctx.close();
