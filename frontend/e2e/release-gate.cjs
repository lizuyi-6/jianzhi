#!/usr/bin/env node
/**
 * 一键发布门禁：构建 → 启动 vite preview → 对生产构建执行 Golden Flow → 收尾。
 * 用法：npm run release:gate
 * 若 4173 已有 preview 在运行，则直接复用且不负责关闭。
 */
const { spawn } = require('node:child_process');

const PREVIEW_URL = process.env.PREVIEW_URL || 'http://localhost:4173';

async function reachable(url) {
  try { const r = await fetch(url); return r.ok; } catch { return false; }
}

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await reachable(url)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false, env: { ...process.env, ...env } });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function killPreview(preview) {
  if (!preview) return;
  try { process.kill(-preview.pid, 'SIGTERM'); } catch { preview.kill('SIGTERM'); }
}

(async () => {
  const alreadyRunning = await reachable(PREVIEW_URL);
  let preview = null;

  if (alreadyRunning) {
    console.log('[release-gate] 检测到 preview 已在运行，直接复用：' + PREVIEW_URL);
  } else {
    console.log('[release-gate] 启动 vite preview …');
    // 直接起 vite 的 node 进程（绕开 npx 包裹层），并用独立进程组保证收尾能杀干净
    const path = require('node:path');
    const viteBin = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
    preview = spawn(process.execPath, [viteBin, 'preview', '--host', '0.0.0.0', '--port', '4173'], { stdio: 'inherit', shell: false, detached: true });
    const ok = await waitFor(PREVIEW_URL);
    if (!ok) {
      console.error('[release-gate] preview 启动超时');
      killPreview(preview);
      process.exit(2);
    }
  }

  // 注意：不在 try 内 process.exit()——它会绕过 finally 的清理，
  // 失败路径同样必须走完 killPreview 再退出。
  let exitCode = 0;
  try {
    console.log('[release-gate] 对生产构建执行 Golden Flow …');
    const code = await run(process.execPath, ['e2e/verify.cjs'], { PROD: '1', FRONTEND_URL: PREVIEW_URL });
    if (code !== 0) {
      console.error('[release-gate] FAIL：生产 Golden Flow 未通过');
      exitCode = code;
    } else {
      console.log('[release-gate] PASS：生产构建通过发布门禁');
    }
  } finally {
    killPreview(preview);
    await new Promise((r) => setTimeout(r, 800));
  }
  process.exitCode = exitCode;
})().catch((e) => { console.error('[release-gate] FATAL', e.message); process.exit(1); });
