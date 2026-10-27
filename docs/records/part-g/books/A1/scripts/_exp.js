// helper: install capture of app downloads (anchor clicks with download attr)
async function installCapture(page) {
  await page.evaluate(() => {
    window.showSaveFilePicker = undefined;
    window.__dl = null;
    if (window.__dlInstalled) return; window.__dlInstalled = true;
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        const name = this.download, href = this.href;
        fetch(href).then(r => r.arrayBuffer()).then(buf => {
          let s = ''; const b = new Uint8Array(buf);
          for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
          window.__dl = { name, b64: btoa(s) };
        });
        return;
      }
      return orig.call(this);
    };
  });
}
async function takeCapture(page, outPath) {
  for (let i = 0; i < 60; i++) {
    const d = await page.evaluate(() => window.__dl);
    if (d) { fs.writeFileSync(outPath, Buffer.from(d.b64, 'base64')); return d.name + ' ' + fs.statSync(outPath).size + ' bytes'; }
    await page.waitForTimeout(500);
  }
  return 'no capture';
}
