// globals: SCENE (scene title to navigate), START (unique start text of paragraph), NEW (replacement text)
if (!page.url().includes('/manuscript')) { await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/manuscript'); await page.waitForTimeout(2500); }
if (typeof CHAP !== 'undefined') { await page.getByRole('treeitem').filter({ hasText: '· ' + CHAP + ',' }).first().click(); await page.waitForTimeout(1200); }
await page.getByRole('treeitem').filter({ hasText: new RegExp('^' + SCENE + '$') }).first().click(); await page.waitForTimeout(1500);
const ed = page.locator('.cm-content');
const eb = await page.locator('.cm-scroller').first().boundingBox(); await page.mouse.move(eb.x + eb.width/2, eb.y + eb.height/2);
let line = ed.locator('.cm-line').filter({ hasText: START }).first();
for (let i = 0; i < 40 && !(await line.count()); i++) { await page.mouse.wheel(0, 600); await page.waitForTimeout(250); line = ed.locator('.cm-line').filter({ hasText: START }).first(); }
if (!(await line.count())) return 'paragraph not found';
await page.waitForTimeout(800); line = ed.locator('.cm-line').filter({ hasText: START }).first(); await line.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
await line.click({ clickCount: 3 }); await page.waitForTimeout(300);
const sel = await page.evaluate(() => window.getSelection().toString());
if (!sel.startsWith(START)) return 'selection mismatch: ' + sel.slice(0, 80);
await page.evaluate((t) => navigator.clipboard.writeText(t), NEW);
await page.keyboard.press('Control+v'); await page.waitForTimeout(2500);
return 'replaced; selection was ' + sel.length + ' chars';
