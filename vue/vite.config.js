


// vue/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const PRODUCTION_API_BASE_URL = 'https://grainservice.club:8443/nongxinle/api/';

function resolveApiTarget(value) {
  const parsed = new URL(value || PRODUCTION_API_BASE_URL);
  const isProductionBackend =
    parsed.protocol === 'https:' &&
    parsed.origin === 'https://grainservice.club:8443' &&
    parsed.pathname === '/nongxinle/api/';
  const isLocalBackend =
    parsed.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (!isProductionBackend && !isLocalBackend) {
    throw new Error('VITE_API_URL 只允许正式服务器或本机开发地址');
  }
  return parsed.toString().replace(/\/+$/, '') + '/';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiTarget = resolveApiTarget(env.VITE_API_URL);
  return ({
  plugins: [vue()],
  base: './', // 设置为相对路径
  server: {
    host: 'localhost', // 改回localhost
    port: 3000, // 设置为 3000 端口
    strictPort: true, // 如果端口被占用则报错
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
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
