import { open, shot, sleep, BASE, DIR } from './lib.mjs';
const { ctx, page } = await open();
await page.goto(BASE + '/#/');
await sleep(2500);
await page.getByRole('button', { name: 'More actions for The Long Round' }).click();
await sleep(800);
const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.getByText('Single file', { exact: true }).click(),
]);
await dl.saveAs(DIR + '/backup.pwk');
console.log('saved', dl.suggestedFilename());
await ctx.close();
