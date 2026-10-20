const { spawn } = require('node:child_process');
const path = require('node:path');
const electronPath = require('electron');
const waitOn = require('wait-on');

const repoDir = path.resolve(__dirname, '..');
// IMPORTANT: 本地源码启动永远属于 development，必须连接测试服务器。
// 不要改成继承 shell 中的 API 地址，也不要为了联调临时指向正式服务器；
// src/main.js 和 vue/vite.config.js 会再次校验同一约束，避免后续改动误连生产。
const testApiBaseUrl = 'https://test-api.grainservice.club/nongxinle/api/';

async function start() {
  await waitOn({ resources: ['http://localhost:3000'], timeout: 120_000 });
  const child = spawn(electronPath, ['.'], {
    cwd: repoDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      GRAIN_RUNTIME_MODE: 'development',
      NXL_DISPATCH_API_BASE_URL: testApiBaseUrl,
      NXL_ORDER_API_BASE_URL: testApiBaseUrl,
      GRAIN_API_URL: testApiBaseUrl,
    },
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (!child.killed) child.kill(signal);
    });
  }
  child.on('error', (error) => {
    console.error('[dev:electron] Electron 启动失败:', error.message);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = signal ? 0 : (code ?? 1);
  });
}

start().catch((error) => {
  console.error('[dev:electron] 等待 Vite 或启动 Electron 失败:', error.message);
  process.exitCode = 1;
});
