const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.setItem('zj-conditions', JSON.stringify({ family_pressure: 'FAMILY_PRESSURE' })));
  await page.screenshot({ path: '/tmp/prod-question.png' });
  await page.goto('http://localhost:4173/read/CLASSIC', { waitUntil: 'networkidle' });
  await page.waitForSelector('.why-panel');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/prod-read-c.png' });
  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e.message); process.exit(1); });
