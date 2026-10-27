// globals: CH (chapter title), FILE (draft path)
const text = fs.readFileSync(DIR + '/drafts/' + FILE, 'utf8').replace(/\s+$/,'') + '\n';
const ed = page.locator('.cm-content');
// go to chapter via binder so its heading is visible
await page.getByRole('treeitem').filter({ hasText: '· ' + CH + ',' }).first().click();
await page.waitForTimeout(1200);
const line = ed.locator('.cm-line').filter({ hasText: new RegExp('^# ' + CH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();
await line.scrollIntoViewIfNeeded();
const box = await line.boundingBox();
// click near the end of the heading text
await page.mouse.click(box.x + 5, box.y + box.height / 2);
await page.keyboard.press('End');
await page.waitForTimeout(200);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
await page.evaluate((t) => navigator.clipboard.writeText(t), text);
await page.keyboard.press('Control+v');
await page.waitForTimeout(4000);
const notices = await page.locator('main').innerText();
return notices.slice(0, 1500);
