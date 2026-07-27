import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { compression as Compression } from 'vite-plugin-compression2'
import { VitePWA } from 'vite-plugin-pwa'
import { autoImportOptionsCfg } from './cfg/auto-import'
import { iconsCfg } from './cfg/icons'
import { pwaCfg } from './cfg/pwa'
import { visualizerPlugin } from './lib/helpers'

const buildDate = new Date()
const buildRevision = buildDate.toISOString()

const appVersion = process.env.VITE_APP_VERSION || '1.0.0'
const isStorybook = !!process.env.STORYBOOK_ENV

export default defineConfig({
  base: isStorybook ? '/docs/' : '/',
  root: fileURLToPath(new URL('../src', import.meta.url)),
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  envDir: fileURLToPath(new URL('../', import.meta.url)),
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },

  resolve: {
    alias: {
      '~': fileURLToPath(new URL('../src', import.meta.url)),
      '@injurka/insight-book-plugin-api': fileURLToPath(new URL('../../../packages/plugin-api/src', import.meta.url)),
      '@injurka/insight-book-plugin-grammar-rules': fileURLToPath(new URL('../../../packages/plugin-grammar-rules/src', import.meta.url)),
    },
  },

  plugins: [
    Vue(),
    AutoImport(autoImportOptionsCfg),
    Compression({
      algorithms: ['gzip'],
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    Compression({
      algorithms: ['brotliCompress'],
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    isStorybook ? null : VitePWA(pwaCfg(buildRevision)),
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

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4445',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    cssCodeSplit: true,
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {},
  },
})
