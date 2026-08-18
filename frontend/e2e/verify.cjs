#!/usr/bin/env node
/**
 * 知鉴 Golden Flow 端到端验证（含 P0-08 demo moment：修改条件 → ReadingSet 变化 → 变化解释）。
 * 前置：backend dev (localhost:3001) 与 frontend（dev 或 preview）均在运行。
 * 用法：npm run verify
 */
const { chromium } = require('playwright');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001';
const IS_PROD = process.env.PROD === '1';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + String(detail).slice(0, 80) : ''));
}

async function reachable(url) {
  try { const r = await fetch(url); return r.ok; } catch { return false; }
}

(async () => {
  if (!(await reachable(BACKEND + '/ready'))) {
    console.error('后端未就绪：请先 cd backend && npm run dev（' + BACKEND + '）');
    process.exit(2);
  }
  if (!(await reachable(FRONTEND))) {
    console.error('前端未就绪：' + FRONTEND);
    process.exit(2);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  // 1. 问题页加载
  await page.goto(FRONTEND + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const devShortcut = await page.getByText('看阅读集', { exact: false }).count();
  check('问题页加载', await page.locator('.question-title').count() === 1);
  if (IS_PROD) {
    check('生产构建完全无快捷入口', devShortcut === 0, '快捷按钮数=' + devShortcut);
  } else {
    check('judge 路径无快捷入口', devShortcut <= 1, '快捷按钮数=' + devShortcut + '（dev mode 允许 1 个带标注的调试入口）');
  }
  check('主入口存在', await page.getByText('按我的情况看').count() >= 1);
  check('来源口径如实（P0-05）', /通过 Evidence 校验/.test(await page.locator('.question-stat').textContent()));

  // 2. 条件抽屉：真实统计（P0-05）+ 跨立场证据（P0-06）+ 选择 Golden 条件
  await page.getByText('按我的情况看').click();
  await page.waitForSelector('.drawer');
  check('抽屉对话框语义（P2-09）', await page.locator('.drawer[role="dialog"][aria-modal="true"]').count() === 1);
  const infoText = await page.locator('.drawer-info').textContent();
  check('抽屉统计真实', /共找到 \d+ 条来源内容，其中 \d+ 条通过 Evidence 校验/.test(infoText), infoText.trim().slice(0, 60));

  // 展开「为什么这么说」，验证跨立场证据可回到原文
  await page.locator('.why-toggle').first().click();
  await page.waitForSelector('.why-examples');
  const exampleCount = await page.locator('.why-examples .example-item').count();
  check('分歧条件有跨立场证据（P0-06）', exampleCount >= 2, '示例数=' + exampleCount);
  const exampleQuote = await page.locator('.example-quote').first().textContent();
  check('证据带原文引句', /「.+」/.test(exampleQuote), exampleQuote.slice(0, 40));

  const yourSection = page.locator('.drawer-section').nth(1);
  await yourSection.getByText('已有满意 Offer / 入职机会').click();
  await yourSection.getByText('实践与就业优先').click();
  // F-005：三态按钮存在
  check('不确定 / 都不像可选项存在（P1-04）', await yourSection.getByText('不确定').count() >= 1 && await yourSection.getByText('都不像 / 不重要').count() >= 1);
  await page.locator('.drawer-cta').click();
  await page.waitForURL('**/reading-set', { timeout: 15000 });
  await page.waitForSelector('.role-card');
  await page.waitForTimeout(500);

  // 3. 阅读集不变量
  const roleCards = await page.locator('.role-card:not(.role-empty)').count();
  const emptyCards = await page.locator('.role-empty').count();
  const warnings = await page.locator('.warnings-card').count();
  check('Golden 三角色齐备（A/B/C）', roleCards === 3, 'cards=' + roleCards);
  check('无空位', emptyCards === 0);
  check('无警告', warnings === 0);
  check('TA 的选择有 Evidence 引用', await page.locator('.cmp-decision').count() >= 2);
  const diffTexts = await page.locator('.cmp-row:has(.cmp-diff) .cmp-text').allTextContents();
  check('差异双边可见（P1-08）', diffTexts.length === 0 || diffTexts.every((t) => t.includes('你「') && t.includes('TA「')), diffTexts.join(' | ').slice(0, 60));

  const slotABefore = await page.locator('.role-card[data-slot-source]').nth(0).getAttribute('data-slot-source');

  // 4. P0-08 demo moment：修改条件 → ReadingSet 真实变化 + 变化解释
  await page.getByText('修改条件').click();
  await page.waitForSelector('.drawer');
  await page.locator('.drawer-section').nth(1).getByText('考研失利').click();
  await page.locator('.drawer-cta').click();
  await page.waitForSelector('[data-testid="change-report"]', { timeout: 15000 });
  await page.waitForTimeout(600);
  const changeText = await page.locator('[data-testid="change-report"]').textContent();
  check('变化解释卡出现（P0-08/F-009）', /条件变化如何改变了阅读集/.test(changeText), changeText.slice(0, 50));
  check('变化解释包含修改维度', changeText.includes('考研结果'), '提及考研结果');
  const slotAAfter = await page.locator('.role-card[data-slot-source]').nth(0).getAttribute('data-slot-source');
  check('至少一个 Slot 的 source_id 改变', slotAAfter !== slotABefore, slotABefore + ' -> ' + slotAAfter);

  // 5. 阅读视图：Evidence 高亮与来源依据一一对应
  await page.locator('.role-card:not(.role-empty)').first().click();
  await page.waitForSelector('.why-panel');
  await page.waitForTimeout(500);
  const marks = await page.locator('.ev-mark').count();
  const refs = await page.locator('.evidence-item').count();
  const invalid = await page.locator('.evidence-item.invalid').count();
  check('Evidence 高亮数 = 来源依据数', marks === refs && marks > 0, marks + ' vs ' + refs);
  check('无失效引用', invalid === 0);
  await page.goto(FRONTEND + '/read/CLASSIC');
  await page.waitForSelector('.why-panel');
  await page.waitForTimeout(400);
  const unknownTexts = await page.locator('.why-unknown').allTextContents();
  check(
    'Unknown 不做推测',
    unknownTexts.length > 0 && unknownTexts.every((t) => t.includes('当前检索片段未提及') && t.includes('不做推测')),
    unknownTexts.length + ' 处 Unknown 文案',
  );
  check('空引用不伪造', (await page.locator('.evidence-item.invalid').count()) === 0);

  // 6. 控制台零错误
  check('控制台零错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== ' + (results.length - failed.length) + '/' + results.length + ' 项通过 ===');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
