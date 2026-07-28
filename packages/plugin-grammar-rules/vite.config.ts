import { fileURLToPath, URL } from 'node:url'
import { federation } from '@module-federation/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      // Алиасы повторяют маппинг host-приложения (apps/client/build/vite.config.web.ts)
      '~': fileURLToPath(new URL('../../apps/client/src', import.meta.url)),
      '@injurka/insight-book-plugin-api': fileURLToPath(new URL('../plugin-api/src', import.meta.url)),
      '@injurka/insight-book-plugin-grammar-rules': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    federation({
      name: 'plugin_grammar_rules',
      filename: 'remoteEntry.js',
      exposes: {
        './Plugin': './src/index.ts',
      },
      shared: {
        'vue': { singleton: true },
        'vue-router': { singleton: true },
        'pinia': { singleton: true },
        '@injurka/insight-book-plugin-api': { singleton: true },
      },
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use '~/assets/scss/_setup.scss' as *;`,
      },
    },
  },
})
