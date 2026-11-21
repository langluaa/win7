// End-to-end tests: drive the production build in a real Chromium.
// Usage: npm run build && npm run test:e2e
// Requires the `playwright` package (globally installed is fine) with Chromium.
import { createRequire } from 'node:module';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

let failures = 0;
let passes = 0;
const results = [];
async function test(name, fn) {
  try {
    await fn();
    passes++;
    results.push(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    results.push(`  ✗ ${name}\n      ${String(e.message).split('\n')[0]}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const server = await preview({ preview: { port: 4321, strictPort: false }, logLevel: 'silent' });
const URL = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const errors = [];

async function bootToDesktop(page) {
  await page.waitForSelector('.screen.boot, .logon-tile');
  if (await page.locator('.screen.boot').count()) await page.click('.screen.boot');
  await page.waitForSelector('.logon-tile');
  await page.click('.logon-tile');
  await page.waitForSelector('.session.shown', { timeout: 8000 });
  await page.waitForTimeout(300);
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL);

await test('boots through the logon screen to the desktop', async () => {
  await bootToDesktop(page);
  assert((await page.locator('.desk-icon').count()) >= 7, 'expected desktop icons');
  assert(await page.locator('.taskbar .start-orb').isVisible(), 'start orb missing');
});

await test('Start menu search launches programs', async () => {
  await page.click('.start-orb');
  await page.fill('.sm-search-input', 'notepad');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.win7-window[data-app="notepad"]');
});

await test('Notepad saves a file through the Save As dialog', async () => {
  await page.click('.win7-window[data-app="notepad"] .np-text');
  await page.keyboard.type('Hello from the e2e test');
  await page.keyboard.press('Control+s');
  await page.waitForSelector('.filedlg');
  await page.fill('.filedlg .fd-field input', 'e2e note');
  await page.click('.filedlg .w7-btn:has-text("Save")');
  await page.waitForTimeout(300);
  const title = await page.locator('.win7-window[data-app="notepad"]').getAttribute('aria-label');
  assert(title === 'e2e note - Notepad', `unexpected title: ${title}`);
});

await test('windows drag, resize, minimize, restore and maximize', async () => {
  const win = page.locator('.win7-window[data-app="notepad"]');
  const before = await win.boundingBox();
  const tb = await win.locator('.wf-titlebar').boundingBox();
  await page.mouse.move(tb.x + 150, tb.y + 10);
  await page.mouse.down();
  await page.mouse.move(tb.x + 250, tb.y + 70, { steps: 6 });
  await page.mouse.up();
  const moved = await win.boundingBox();
  assert(Math.abs(moved.x - before.x - 100) < 3 && Math.abs(moved.y - before.y - 60) < 3, 'window did not move');
  const se = await win.locator('.wf-se').boundingBox();
  await page.mouse.move(se.x + 5, se.y + 5);
  await page.mouse.down();
  await page.mouse.move(se.x + 85, se.y + 45, { steps: 5 });
  await page.mouse.up();
  const resized = await win.boundingBox();
  assert(resized.width - moved.width > 70, 'window did not resize');
  await win.locator('.wf-min').click();
  await page.waitForTimeout(350);
  assert(await win.evaluate((el) => el.classList.contains('minimized')), 'not minimized');
  await page.click('.tb-btn[aria-label="Notepad"]');
  await page.waitForTimeout(350);
  assert(!(await win.evaluate((el) => el.classList.contains('minimized'))), 'not restored');
  await win.locator('.wf-max').click();
  const max = await win.boundingBox();
  assert(max.width === 1280, `maximized width ${max.width}`);
  await win.locator('.wf-close').click();
  await page.waitForTimeout(300);
});

await test('desktop icons can be dragged and the position persists', async () => {
  const icon = page.locator('.desk-icon:has-text("Read me")');
  const b = await icon.boundingBox();
  await page.mouse.move(b.x + 30, b.y + 20);
  await page.mouse.down();
  await page.mouse.move(b.x + 430, b.y - 300, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = await icon.boundingBox();
  assert(after.x > b.x + 300, 'icon did not move');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('win7.settings.v1')).iconPositions['desk-readme']);
  assert(saved && saved.c > 3, 'position not saved');
});

await test('Calculator works from the keyboard', async () => {
  await page.dblclick('.desk-icon:has-text("Calculator")');
  await page.waitForSelector('.calc');
  await page.keyboard.type('125/5=');
  const v = await page.textContent('.calc-main');
  assert(v.trim() === '25', `got ${v}`);
  await page.click('.win7-window[data-app="calc"] .wf-close');
});

await test('Minesweeper first click is always safe', async () => {
  await page.dblclick('.desk-icon:has-text("Minesweeper")');
  await page.waitForSelector('.ms-cell');
  await page.locator('.ms-cell').nth(40).click();
  await page.waitForTimeout(200);
  assert((await page.locator('.ms-cell.open').count()) >= 1, 'nothing revealed');
  assert((await page.locator('.ms-cell.boom').count()) === 0, 'exploded on first click');
  await page.click('.win7-window[data-app="minesweeper"] .wf-close');
});

await test('Control Panel changes the wallpaper', async () => {
  await page.click('.start-orb');
  await page.click('.sm-link:has-text("Control Panel")');
  await page.click('.cp-cat-link:has-text("Change desktop background")');
  await page.click('.cp-wp[title="Lake"]');
  await page.click('.cp-footer .w7-btn:has-text("Save changes")');
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.desktop')).backgroundImage);
  assert(bg.includes('lake.svg'), `background is ${bg}`);
  await page.click('.win7-window[data-app="control"] .wf-close');
});

await test('Delete to Recycle Bin and restore', async () => {
  await page.click('.desk-icon:has-text("Read me")');
  await page.keyboard.press('Delete');
  await page.click('.msgbox .w7-btn:has-text("Yes")');
  await page.waitForTimeout(250);
  assert((await page.locator('.desk-icon:has-text("Read me")').count()) === 0, 'still on desktop');
  await page.dblclick('.desk-icon[data-key="sys:recycle"]');
  await page.click('.tb-flat:has-text("Restore all items")');
  await page.waitForTimeout(250);
  assert((await page.locator('.desk-icon:has-text("Read me")').count()) === 1, 'not restored');
  await page.click('.win7-window[data-app="explorer"] .wf-close');
});

await test('files and settings persist after a reload', async () => {
  await page.waitForTimeout(600); // debounce
  await page.reload();
  await bootToDesktop(page);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.desktop')).backgroundImage);
  assert(bg.includes('lake.svg'), 'wallpaper not persisted');
  await page.click('.start-orb');
  await page.click('.sm-link:has-text("Documents")');
  await page.waitForSelector('.ex-item:has-text("e2e note")');
});

await test('Shut down reaches the power-off screen', async () => {
  await page.click('.start-orb');
  await page.click('.sm-shutdown');
  await page.waitForSelector('.screen.off', { timeout: 6000 });
});

await ctx.close();

// ---------------------------------------------------------------- touch device
const phone = await browser.newContext({ ...devices['Pixel 7'] });
const mp = await phone.newPage();
mp.on('pageerror', (e) => errors.push('[touch] ' + e.message));
await mp.goto(URL);

await test('touch: double-tap opens a maximized window', async () => {
  await mp.tap('.screen.boot');
  await mp.waitForSelector('.logon-tile');
  await mp.tap('.logon-tile');
  await mp.waitForSelector('.session.shown', { timeout: 8000 });
  await mp.waitForTimeout(300);
  const icon = mp.locator('.desk-icon[data-key="sys:computer"]');
  await icon.tap();
  await mp.waitForTimeout(100);
  await icon.tap();
  await mp.waitForSelector('.win7-window.maximized');
  assert((await mp.locator('.win7-window').count()) === 1, 'expected exactly one window');
  await mp.tap('.win7-window .wf-close');
  await mp.waitForTimeout(300);
});

await test('touch: long-press opens the context menu', async () => {
  const box = await mp.locator('.desktop').boundingBox();
  const x = box.width - 60;
  const y = 200;
  const cdp = await phone.newCDPSession(mp);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await mp.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mp.waitForSelector('.w7-menu', { timeout: 2000 });
});

await phone.close();
await browser.close();
await server.close();

console.log(`\nWindows 7 simulator e2e\n${results.join('\n')}\n`);
if (errors.length) {
  console.log('Page errors:\n  ' + errors.join('\n  '));
  failures++;
}
console.log(`${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
