const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  // 问题页首屏
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'v1-viewport.png' });

  // B 空位路径：不选任何条件直接生成（阅读集 auto-generate with {}）
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('http://localhost:5173/reading-set', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'v6-reading-set-empty.png', fullPage: true });
  const emptyCards = await page.locator('.role-empty').count();
  const warnText = await page.locator('.warnings-card').allTextContents();
  const errCard = await page.locator('.inline-error-card').allTextContents();
  console.log(JSON.stringify({ errs, emptyCards, warnText, errCard }));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
