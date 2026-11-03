import { open, shot, sleep, W, DIR } from './lib.mjs';
import fs from 'fs';
const { ctx, page } = await open({height: 1400});
await page.addInitScript(() => {
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.href && this.href.startsWith('blob:')) {
      const name = this.download;
      fetch(this.href).then(r => r.text()).then(t => { window.__dl = { name, t }; });
      return;
    }
    return orig.call(this);
  };
});
await page.goto(W + '/manuscript');
await sleep(3000);
await page.getByRole('tab', { name: /^All timelines/ }).first().click();
await sleep(2000);
const pg = page.getByRole('button', { name: /^Page$/ });
if (await pg.count()) { await pg.click(); await sleep(2000); }
await page.getByRole('button', { name: /^Export/ }).first().click();
await sleep(1500);
const d = page.getByRole('dialog');
const cover = d.getByLabel(/world cover/i);
if (await cover.count() && await cover.isEnabled() && await cover.isChecked()) await cover.uncheck();
await d.getByRole('button', { name: 'Download .md' }).click();
await page.waitForFunction(() => window.__dl, null, { timeout: 60000 });
const dl = await page.evaluate(() => window.__dl);
fs.writeFileSync(DIR + '/export.md', dl.t);
console.log('saved', dl.name, dl.t.length);
await ctx.close();
