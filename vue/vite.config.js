


// vue/vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const PRODUCTION_API_BASE_URL = 'https://grainservice.club:8443/nongxinle/api/';
// 联调专用：测试服务器（62.234.114.61，域名 test-api.grainservice.club）。
const TEST_API_BASE_URL = 'https://test-api.grainservice.club/nongxinle/api/';

export default defineConfig(({ mode }) => {
  // 与 Electron 主进程保持同一条不可变规则：`npm start` 使用 development，
  // 必须编译为测试服务器地址并保留用户 ID 测试登录；production 才能连接正式服务器。
  // 不要退回读取通用 .env 或浏览器运行状态来猜测后端环境。
  const expectedRuntime = mode === 'development'
    ? { runtimeMode: 'development', apiUrl: TEST_API_BASE_URL }
    : mode === 'test'
      ? { runtimeMode: 'test', apiUrl: TEST_API_BASE_URL }
      : mode === 'production'
        ? { runtimeMode: 'production', apiUrl: PRODUCTION_API_BASE_URL }
        : null;
  if (!expectedRuntime) throw new Error(`不支持的 Vue 运行模式：${mode}`);
  const apiTarget = expectedRuntime.apiUrl;
  return ({
  plugins: [vue()],
  base: './', // 设置为相对路径
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(apiTarget),
    'import.meta.env.VITE_RUNTIME_MODE': JSON.stringify(expectedRuntime.runtimeMode),
  },
  server: {
    host: 'localhost', // 改回localhost
    port: 3000, // 设置为 3000 端口
    strictPort: true, // 如果端口被占用则报错
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        // 本地代理把后端 context path 隐藏为 /api；扫码登录的会话 Cookie
        // 也必须改到浏览器实际访问的路径，订单明细请求才能携带它。
        cookiePathRewrite: '/api',
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // 浏览器只访问同源的 Vite；远端请求由开发代理发起，避免转发 localhost Origin。
            proxyReq.removeHeader('origin');
          });
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/vue'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'vuex'],
          'bootstrap': ['bootstrap', 'bootstrap-vue-3']
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
  });
});
