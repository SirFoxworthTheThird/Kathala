// Long-running browser driver: POST JS (async function body with `page`, `ctx`) to http://127.0.0.1:5311/
import { chromium } from '/home/user/PlotWeave/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';

const DIR = '/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/partg/A1';
const ctx = await chromium.launchPersistentContext(DIR + '/profile', {
  executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  headless: true,
  viewport: { width: 1500, height: 1000 },
  acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write'],
});
let page = ctx.pages()[0] || (await ctx.newPage());
page.setDefaultTimeout(15000);
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

const server = http.createServer(async (req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    if (req.url === '/quit') { res.end('bye'); await ctx.close(); process.exit(0); }
    try {
      const fn = new Function('page', 'ctx', 'fs', 'DIR', 'logs', `return (async () => { ${body} })();`);
      const out = await fn(page, ctx, fs, DIR, logs);
      res.end(typeof out === 'string' ? out : JSON.stringify(out, null, 1) ?? 'ok');
    } catch (e) {
      res.statusCode = 500;
      res.end('ERROR: ' + (e && e.stack ? e.stack : String(e)));
    }
  });
});
server.listen(5311, '127.0.0.1', () => console.log('driver ready'));
