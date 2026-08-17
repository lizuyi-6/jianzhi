const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  const out = {};

  // 1. 问题页：关注问题 toast + localStorage
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.getByText('关注问题', { exact: true }).click();
  out.followToast = await page.locator('.toast').textContent();
  out.followPersisted = await page.evaluate(() => localStorage.getItem('zj-follow-question'));

  // 2. 加载更多
  const before = await page.locator('.feed-item').count();
  await page.getByText('加载更多').click();
  await page.waitForFunction((n) => document.querySelectorAll('.feed-item').length > n, before, { timeout: 10000 });
  out.feedBefore = before;
  out.feedAfter = await page.locator('.feed-item').count();

  // 3. 顶栏搜索（真实知乎 API）
  await page.fill('.searchbox input', '读研还是工作');
  await page.press('.searchbox input', 'Enter');
  await page.waitForURL('**/search**');
  await page.waitForSelector('.feed-item', { timeout: 20000 });
  out.searchCount = await page.locator('.feed-item').count();
  out.searchMeta = await page.locator('.search-meta').textContent();

  // 4. 搜索结果 → 来源详情页 → 收藏
  await page.locator('.feed-title a').first().click();
  await page.waitForURL('**/source/**');
  await page.waitForSelector('.read-body');
  await page.locator('.collect-btn').click();
  out.collectToast = await page.locator('.toast').textContent();
  out.collected = await page.evaluate(() => localStorage.getItem('zj-collections'));

  // 5. 收藏页 & 历史页
  await page.goto('http://localhost:5173/collections');
  out.collectionsRows = await page.locator('.list-row').count();
  await page.goto('http://localhost:5173/history');
  out.historyRows = await page.locator('.list-row').count();

  // 6. 话题关注 → 关注页
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.locator('.sidenav-topic .topic-star').first().click();
  await page.goto('http://localhost:5173/follows');
  out.followsText = (await page.locator('.page-main').textContent()).slice(0, 120);

  // 7. 通知铃铛
  await page.locator('.icon-btn').click();
  out.bellPanel = await page.locator('.bell-empty').textContent();

  // 8. 相关问题 → 搜索页
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.locator('.rail-list .rail-link').first().click();
  await page.waitForURL('**/search**');
  out.relatedToSearch = page.url().includes('/search?q=');

  // 9. 阅读视图收藏按钮
  await page.evaluate(() => sessionStorage.setItem('zj-conditions', JSON.stringify({ family_pressure: 'FAMILY_PRESSURE' })));
  await page.goto('http://localhost:5173/reading-set', { waitUntil: 'networkidle' });
  await page.waitForSelector('.role-card');
  await page.locator('.role-card').first().click();
  await page.waitForSelector('.why-panel');
  await page.locator('.read-card .collect-btn').click();
  out.readCollectToast = await page.locator('.toast').textContent();

  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
