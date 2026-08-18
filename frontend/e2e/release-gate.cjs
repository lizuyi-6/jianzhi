#!/usr/bin/env node
/**
 * 一键发布门禁（P0-11 修复）：
 *   1) 构建生产产物（由 npm run release:gate 先行执行）
 *   2) 自选一个动态空闲端口启动 vite preview（strictPort，绝不复用任何已在运行的服务）
 *   3) 对该实例执行生产 Golden Flow
 *   4) 无论成败都关闭自己启动的 preview
 */
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) return true; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function runVerify(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['e2e/verify.cjs'], { stdio: 'inherit', shell: false, env: { ...process.env, ...env } });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

(async () => {
  const port = await freePort();
  const previewUrl = 'http://localhost:' + port;
  console.log('[release-gate] 使用专用动态端口自起 preview：' + previewUrl + '（strictPort，不复用任何已有服务）');

  const viteBin = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
  const preview = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore', shell: false, detached: true });

  let exitCode = 0;
  try {
    const ok = await waitFor(previewUrl);
    if (!ok) {
      console.error('[release-gate] FAIL：preview 启动超时');
      exitCode = 2;
    } else {
      console.log('[release-gate] 对刚构建的生产产物执行 Golden Flow …');
      const code = await runVerify({ PROD: '1', FRONTEND_URL: previewUrl });
      if (code !== 0) {
        console.error('[release-gate] FAIL：生产 Golden Flow 未通过');
        exitCode = code;
      } else {
        console.log('[release-gate] PASS：生产构建通过发布门禁');
      }
    }
  } finally {
    // 无论成败都清理自己启动的 preview（detached 进程组整体终止）
    try { process.kill(-preview.pid, 'SIGTERM'); } catch { try { preview.kill('SIGTERM'); } catch { /* already gone */ } }
    await new Promise((r) => setTimeout(r, 800));
  }
  process.exitCode = exitCode;
})().catch((e) => { console.error('[release-gate] FATAL', e.message); process.exit(1); });
