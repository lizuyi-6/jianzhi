#!/usr/bin/env node
/**
 * 知鉴 Golden Flow 端到端验证。
 * 前置：backend dev (localhost:3001) 与 frontend dev (localhost:5173) 均在运行。
 * 用法：npm run verify
 */
const { chromium } = require('playwright');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001';
const IS_PROD = process.env.PROD === '1';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
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
    console.error('前端未就绪：请先 cd frontend && npm run dev（' + FRONTEND + '）');
    process.exit(2);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  // 1. 问题页：主入口只有「按我的情况看」，无「看阅读集」快捷按钮（dev 按钮允许存在于 dev mode）
  await page.goto(FRONTEND + '/', { waitUntil: 'networkidle' });
  const devShortcut = await page.getByText('看阅读集', { exact: false }).count();
  check('问题页加载', await page.locator('.question-title').count() === 1);
  if (IS_PROD) {
    check('生产构建完全无快捷入口', devShortcut === 0, '快捷按钮数=' + devShortcut);
  } else {
    check('judge 路径无快捷入口', devShortcut <= 1, '快捷按钮数=' + devShortcut + '（dev mode 允许 1 个带标注的调试入口）');
  }
  check('主入口存在', await page.getByText('按我的情况看').count() >= 1);

  // 2. 条件抽屉：真实统计 + 选择 Golden 条件
  await page.getByText('按我的情况看').click();
  await page.waitForSelector('.drawer');
  const infoText = await page.locator('.drawer-info').textContent();
  check('抽屉统计真实', /已从 \d+ 条真人内容中提炼出 \d+ 个可靠分歧条件/.test(infoText), infoText.trim());

  const yourSection = page.locator('.drawer-section').nth(1);
  await yourSection.getByText('希望尽快经济独立').click();
  await page.getByText('先看这几篇').click();
  await page.waitForURL('**/reading-set', { timeout: 15000 });
  await page.waitForSelector('.role-card');
  await page.waitForTimeout(500);

  // 3. 阅读集不变量：三角色齐备、无空位、无警告、无统一结论排序
  const roleCards = await page.locator('.role-card:not(.role-empty)').count();
  const emptyCards = await page.locator('.role-empty').count();
  const warnings = await page.locator('.warnings-card').count();
  check('Golden 三角色齐备（A/B/C）', roleCards === 3, 'cards=' + roleCards);
  check('无空位', emptyCards === 0);
  check('无警告', warnings === 0);
  check('TA 的选择有 Evidence 引用', await page.locator('.cmp-decision').count() >= 2);

  // 4. 阅读视图：Evidence 高亮与来源依据一一对应
  await page.locator('.role-card:not(.role-empty)').first().click();
  await page.waitForSelector('.why-panel');
  await page.waitForTimeout(500);
  const marks = await page.locator('.ev-mark').count();
  const refs = await page.locator('.evidence-item').count();
  const invalid = await page.locator('.evidence-item.invalid').count();
  check('Evidence 高亮数 = 来源依据数', marks === refs && marks > 0, marks + ' vs ' + refs);
  check('无失效引用', invalid === 0);
  // C 卡（经典视角）在 Golden 下 unknown_dimensions 非空，用它真正走 Unknown 路径
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

  // 5. 控制台零错误
  check('控制台零错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== ' + (results.length - failed.length) + '/' + results.length + ' 项通过 ===');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
