import { open, shot, sleep, BASE, DIR } from './lib.mjs';
import fs from 'fs';
const out = process.argv[2] || 'backup.pwk';
const { ctx, page } = await open();
await page.addInitScript(() => {
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.href && this.href.startsWith('blob:')) {
      const name = this.download;
      fetch(this.href).then(r => r.arrayBuffer()).then(buf => {
        const bytes = new Uint8Array(buf); let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        window.__dl = { name, b64: btoa(bin) };
      });
      return;
    }
    return orig.call(this);
  };
});
await page.goto(BASE + '/#/');
await sleep(3000);
await page.getByRole('button', { name: 'More actions for The Long Round' }).click();
await sleep(800);
await page.getByText('Single file', { exact: true }).click();
await page.waitForFunction(() => window.__dl, null, { timeout: 60000 });
const dl = await page.evaluate(() => window.__dl);
fs.writeFileSync(DIR + '/' + out, Buffer.from(dl.b64, 'base64'));
console.log('saved', dl.name, fs.statSync(DIR + '/' + out).size);
await ctx.close();
