const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  // 1. 问题页
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'v1-question.png', fullPage: true });

  // 2. 打开条件抽屉
  await page.getByText('按我的情况看').click();
  await page.waitForSelector('.drawer');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'v2-drawer.png' });

  // 3. 选择条件：家庭压力 = 希望尽快经济独立（你的情况区）
  const yourSection = page.locator('.drawer-section').nth(1);
  await yourSection.getByText('希望尽快经济独立').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'v3-drawer-selected.png' });

  // 4. 生成阅读集
  await page.getByText('先看这几篇').click();
  await page.waitForURL('**/reading-set', { timeout: 10000 });
  await page.waitForSelector('.role-card');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'v4-reading-set.png', fullPage: true });

  // 5. 打开 A 卡阅读视图
  await page.locator('.role-card').first().click();
  await page.waitForSelector('.why-panel');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'v5-read.png', fullPage: true });

  // 6. 验证高亮与依据数量一致
  const marks = await page.locator('.ev-mark').count();
  const refs = await page.locator('.evidence-item').count();
  const warnings = await page.locator('.warnings-card').count();

  console.log(JSON.stringify({ consoleErrors, marks, refs, warnings }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
