


// vue/vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  base: './', // 设置为相对路径
  server: {
    host: 'localhost', // 改回localhost
    port: 3000, // 设置为 3000 端口
    strictPort: true, // 如果端口被占用则报错
    proxy: {
      '/api': {
        target: 'http://localhost:8080/nongxinle_war_exploded/api/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
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
