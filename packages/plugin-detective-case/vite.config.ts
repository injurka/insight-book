import { fileURLToPath, URL } from 'node:url'
import { federation } from '@module-federation/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    federation({
      name: 'plugin_detective_case',
      filename: 'remoteEntry.js',
      exposes: {
        './Plugin': './src/index.ts',
      },
      shared: {
        vue: { singleton: true },
        'vue-router': { singleton: true },
        '@injurka/insight-book-plugin-api': { singleton: true },
      },
      dev: command === 'serve' ? { remoteHmr: 'full-reload' } : undefined,
      dts: false,
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
    port: 5179,
    strictPort: true,
    cors: true,
  },
}))
