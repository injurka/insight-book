import { fileURLToPath, URL } from 'node:url'
import { federation } from '@module-federation/vite'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { compression as Compression } from 'vite-plugin-compression2'
import { autoImportOptionsCfg } from './cfg/auto-import'
import { iconsCfg } from './cfg/icons'
import { visualizerPlugin } from './lib/helpers'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  base: './',
  root: fileURLToPath(new URL('../src', import.meta.url)),
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  envDir: fileURLToPath(new URL('../', import.meta.url)),

  resolve: {
    dedupe: ['vue', 'vue-i18n', 'vue-router', 'pinia', '@injurka/insight-book-plugin-api'],
    alias: {
      '~': fileURLToPath(new URL('../src', import.meta.url)),
      '@injurka/insight-book-plugin-grammar-rules': fileURLToPath(new URL('../../../packages/plugin-grammar-rules/src', import.meta.url)),
      '@injurka/insight-book-plugin-scroll-study': fileURLToPath(new URL('../../../packages/plugin-scroll-study/src', import.meta.url)),
    },
  },

  optimizeDeps: {
    include: ['vue', 'vue-i18n', 'vue-router', 'pinia'],
  },

  plugins: [
    Vue(),
    federation({
      name: 'insight_book_host',
      dts: false,
      shared: {
        'vue': { singleton: true },
        'vue-router': { singleton: true },
        'pinia': { singleton: true },
        '@injurka/insight-book-plugin-api': { singleton: true },
      },
    }),
    AutoImport(autoImportOptionsCfg),
    Compression({
      algorithms: ['gzip'],
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    Compression({
      algorithms: ['brotliCompress'],
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    Icons(iconsCfg),
    ...visualizerPlugin('renderer'),
  ],

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use '~/assets/scss/_setup.scss' as *;`,
      },
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },

  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('../src/index.html', import.meta.url)),
      },
    },
  },
})
