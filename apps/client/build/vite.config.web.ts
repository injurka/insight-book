import { resolve } from 'node:path'
import process from 'node:process'
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

export default defineConfig({
  base: process.env.STORYBOOK_ENV ? '/docs/' : '/',
  root: resolve(__dirname, '../src'),
  publicDir: resolve(__dirname, '../public'),
  envDir: resolve(__dirname, '../'),
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
    process.env.STORYBOOK_ENV ? null : VitePWA(pwaCfg(buildRevision)),
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
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // node_modules логика остается как у вас...
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](?:vue|vue-router|pinia|@vueuse)[\\/]/.test(id))
              return 'vendor-core'
            if (id.includes('hanzi-writer'))
              return 'vendor-hanzi'
            if (id.includes('dompurify'))
              return 'vendor-dompurify'
            if (id.includes('@floating-ui') || id.includes('@iconify'))
              return 'vendor-ui'
            if (id.includes('localforage') || id.includes('workbox'))
              return 'vendor-storage'

            return 'vendor-others'
          }

          if (id.includes('/src/components/05.modules/reader/'))
            return 'app-reader'

          if (id.includes('/src/components/05.modules/dictionary/'))
            return 'app-dictionary'

          if (id.includes('/src/components/03.domain/analysis/'))
            return 'app-analysis'

          if (id.includes('/src/shared/locales/'))
            return 'app-locales'
        },
      },
    },
  },
})
