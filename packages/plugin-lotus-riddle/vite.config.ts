import { fileURLToPath, URL } from 'node:url'
import { federation } from '@module-federation/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [
    vue(),
    federation({
      name: 'plugin_lotus_riddle',
      filename: 'remoteEntry.js',
      exposes: {
        './Plugin': './src/index.ts',
      },
      shared: {
        vue: { singleton: true },
        '@iconify/vue': { singleton: true },
        'vue-router': { singleton: true },
        '@injurka/insight-book-plugin-api': { singleton: true },
      },
      dev: command === 'serve' ? { remoteHmr: 'full-reload' } : undefined,
      dts: false,
      bundleAllCSS: true,
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    cors: true,
  },
}))
