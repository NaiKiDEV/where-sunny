// Visual smoke test: welcome overlay, then full pipeline with a seeded origin
// (Vilnius) against the live Open-Meteo API, desktop + mobile viewports.
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const OUT = process.argv[2] ?? '.';
const SEEDED_STATE = JSON.stringify({
  state: { origin: { lat: 54.687, lon: 25.28, label: 'Vilnius' }, tier: 'day', timeWindow: 'today' },
  version: 1,
});

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel });
    } catch {
      /* try next */
    }
  }
  throw new Error('No system Chrome/Edge found');
}

const browser = await launch();
const errors = [];

async function newPage(viewport, seedOrigin) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1.5 });
  if (seedOrigin) {
    await context.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      ['where-sunny-state', SEEDED_STATE],
    );
  }
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text().slice(0, 300)}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${String(err).slice(0, 300)}`));
  return page;
}

const welcome = await newPage({ width: 390, height: 844 }, false);
await welcome.goto(BASE, { waitUntil: 'networkidle' });
await welcome.waitForSelector('.welcome-title', { timeout: 15000 });
await welcome.waitForTimeout(2500);
await welcome.screenshot({ path: `${OUT}/01-welcome-mobile.png` });
console.log('welcome overlay: rendered');
await welcome.context().close();

const mobile = await newPage({ width: 390, height: 844 }, true);
await mobile.goto(BASE, { waitUntil: 'networkidle' });
await mobile.waitForSelector('.place-card', { timeout: 30000 });
await mobile.waitForTimeout(3500); // let tiles + markers settle
const cardCount = await mobile.locator('.place-card').count();
const homeAnchor = await mobile.locator('.home-anchor-verdict').textContent();
console.log(`mobile results: ${cardCount} cards, home verdict: "${homeAnchor}"`);
await mobile.screenshot({ path: `${OUT}/02-results-mobile.png` });

await mobile.locator('.place-card').first().click();
await mobile.waitForSelector('.place-detail-name', { timeout: 5000 });
const detailName = await mobile.locator('.place-detail-name').textContent();
await mobile.waitForSelector('.consensus:not(.consensus-loading)', { timeout: 20000 });
await mobile.waitForSelector('.sun-timeline-track', { timeout: 20000 });
const consensusLevel = await mobile.locator('.consensus-level').textContent();
const timelineCells = await mobile.locator('.sun-timeline-cell').count();
console.log(`detail view: "${detailName.trim()}", consensus: "${consensusLevel}", timeline cells: ${timelineCells}`);
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: `${OUT}/03-detail-mobile.png` });

await mobile.locator('.back-button').click();
await mobile.locator('.section-action').click();
await mobile.waitForSelector('.search-input', { timeout: 5000 });
await mobile.fill('.search-input', 'Akmenė');
await mobile.waitForSelector('.search-result', { timeout: 15000 });
await mobile.locator('.search-result').first().click();
await mobile.waitForSelector('.place-detail-name', { timeout: 20000 });
const pinnedName = await mobile.locator('.place-detail-name').textContent();
const watchState = await mobile.locator('.pin-toggle-detail').textContent();
console.log(`pinned detail: "${pinnedName.trim()}", toggle: "${watchState.trim()}"`);
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: `${OUT}/05-pinned-detail-mobile.png` });
await mobile.locator('.back-button').click();
await mobile.waitForSelector('.place-list-pins', { timeout: 5000 });
const pinCount = await mobile.locator('.place-list-pins .place-card').count();
console.log(`interests section: ${pinCount} pinned place(s)`);
await mobile.screenshot({ path: `${OUT}/06-interests-mobile.png` });
await mobile.context().close();

const desktop = await newPage({ width: 1440, height: 900 }, true);
await desktop.goto(BASE, { waitUntil: 'networkidle' });
await desktop.waitForSelector('.place-card', { timeout: 30000 });
// Open the "When" filter chip and pick Weekend from its popover list.
await desktop.getByRole('button', { name: 'When' }).click();
await desktop.locator('.menu-item', { hasText: 'Weekend' }).click();
await desktop.waitForTimeout(3500);
const desktopCards = await desktop.locator('.place-card').count();
console.log(`desktop weekend results: ${desktopCards} cards`);
await desktop.screenshot({ path: `${OUT}/04-desktop-weekend.png` });
await desktop.context().close();

await browser.close();
const uniqueErrors = [...new Set(errors)];
console.log(uniqueErrors.length ? `BROWSER ERRORS:\n${uniqueErrors.slice(0, 10).join('\n')}` : 'no browser errors');
