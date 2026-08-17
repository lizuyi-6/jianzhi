const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/p0-question.png' });
  await page.evaluate(() => sessionStorage.setItem('zj-conditions', JSON.stringify({ family_pressure: 'FAMILY_PRESSURE' })));
  await page.goto('http://localhost:5173/reading-set', { waitUntil: 'networkidle' });
  await page.waitForSelector('.role-card:not(.role-empty)');
  await page.locator('.role-card:not(.role-empty)').first().click();
  await page.waitForSelector('.why-panel');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/p0-read.png' });
  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e.message); process.exit(1); });
