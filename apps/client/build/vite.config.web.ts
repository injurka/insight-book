import { fileURLToPath, URL } from 'node:url'
import { federation } from '@module-federation/vite'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { compression as Compression } from 'vite-plugin-compression2'
import { VitePWA } from 'vite-plugin-pwa'
import { autoImportOptionsCfg } from './cfg/auto-import.ts'
import { iconsCfg } from './cfg/icons.ts'
import { pwaCfg } from './cfg/pwa.ts'
import { visualizerPlugin } from './lib/helpers.ts'

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
    dedupe: ['vue', 'vue-i18n', 'vue-router', 'pinia', '@injurka/insight-book-plugin-api'],
    alias: {
      '~': fileURLToPath(new URL('../src', import.meta.url)),
      '@injurka/insight-book-plugin-grammar-rules': fileURLToPath(new URL('../../../packages/plugin-grammar-rules/src', import.meta.url)),
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
        'vue-i18n': { singleton: true },
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
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:4445',
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          const getVendorChunk = (pathId: string) => {
            if (pathId.includes('shiki') || pathId.includes('@shikijs'))
              return undefined
            if (/[\\/]node_modules[\\/](?:vue|vue-router|pinia|@vueuse)[\\/]/.test(pathId))
              return 'vendor-core'
            if (pathId.includes('hanzi-writer'))
              return 'vendor-hanzi'
            if (pathId.includes('dompurify'))
              return 'vendor-dompurify'
            if (pathId.includes('@floating-ui') || pathId.includes('@iconify'))
              return 'vendor-ui'
            if (pathId.includes('sqlite') || pathId.includes('workbox'))
              return 'vendor-storage'

            return 'vendor-others'
          }

          if (id.includes('node_modules'))
            return getVendorChunk(id)

          if (id.includes('/src/components/05.modules/reader/'))
            return 'app-reader'
          if (id.includes('/src/components/05.modules/dictionary/'))
            return 'app-dictionary'
          if (id.includes('/src/components/03.domain/analysis/'))
            return 'app-analysis'
          if (id.includes('/src/shared/locales/'))
            return 'app-locales'
          if (id.includes('plugin-grammar-rules'))
            return 'plugin-grammar-rules'
        },
      },
    },
  },
})
