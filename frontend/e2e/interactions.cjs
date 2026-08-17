#!/usr/bin/env node
/**
 * 知鉴交互覆盖验证：关注/收藏/历史/搜索/分页/通知/抽屉。
 * 前置同 verify.cjs。用法：npm run verify:interactions
 */
const { chromium } = require('playwright');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + String(detail).slice(0, 80) : ''));
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto(FRONTEND + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

  // 关注问题 → toast + 持久化
  await page.getByText('关注问题', { exact: true }).click();
  check('关注问题 toast', (await page.locator('.toast').textContent()).includes('已关注'));
  check('关注问题持久化', await page.evaluate(() => localStorage.getItem('zj-follow-question')) === 'true');

  // 加载更多分页
  const before = await page.locator('.feed-item').count();
  await page.getByText('加载更多').click();
  await page.waitForFunction((n) => document.querySelectorAll('.feed-item').length > n, before, { timeout: 10000 });
  check('信息流分页加载', (await page.locator('.feed-item').count()) > before, before + ' -> ' + (await page.locator('.feed-item').count()));

  // 真实搜索
  await page.fill('.searchbox input', '读研还是工作');
  await page.press('.searchbox input', 'Enter');
  await page.waitForURL('**/search**');
  await page.waitForSelector('.feed-item', { timeout: 20000 });
  check('搜索返回真实结果', (await page.locator('.feed-item').count()) > 0);

  // 来源详情 + 收藏
  await page.locator('.feed-title a').first().click();
  await page.waitForURL('**/source/**');
  await page.waitForSelector('.read-body');
  check('来源内容标注', (await page.locator('.content-caption').textContent()).includes('检索片段'));
  await page.locator('.collect-btn').click();
  check('收藏 toast', (await page.locator('.toast').textContent()).includes('已收藏'));

  await page.goto(FRONTEND + '/collections');
  check('收藏页有记录', (await page.locator('.list-row').count()) >= 1);
  await page.goto(FRONTEND + '/history');
  check('历史页有记录', (await page.locator('.list-row').count()) >= 1);

  // 话题关注 → 关注页
  await page.goto(FRONTEND + '/', { waitUntil: 'networkidle' });
  await page.locator('.sidenav-topic .topic-star').first().click();
  await page.goto(FRONTEND + '/follows');
  check('关注页含话题与问题', (await page.locator('.page-main').textContent()).includes('关注的话题'));

  // 通知面板
  await page.locator('.icon-btn').click();
  check('通知空面板', await page.locator('.bell-empty').count() === 1);

  // 相关问题 → 搜索
  await page.goto(FRONTEND + '/', { waitUntil: 'networkidle' });
  await page.locator('.rail-list .rail-link').first().click();
  await page.waitForURL('**/search**');
  check('相关问题跳搜索', page.url().includes('/search?q='));

  // Golden 阅读视图收藏
  await page.evaluate(() => sessionStorage.setItem('zj-conditions', JSON.stringify({ family_pressure: 'FAMILY_PRESSURE' })));
  await page.goto(FRONTEND + '/reading-set', { waitUntil: 'networkidle' });
  await page.waitForSelector('.role-card:not(.role-empty)');
  await page.locator('.role-card:not(.role-empty)').first().click();
  await page.waitForSelector('.why-panel');
  await page.locator('.read-card .collect-btn').click();
  check('阅读视图收藏', (await page.locator('.toast').textContent()).includes('已收藏'));

  check('控制台零错误', errs.length === 0, errs.slice(0, 2).join(' | '));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log('\n=== ' + (results.length - failed.length) + '/' + results.length + ' 项通过 ===');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
