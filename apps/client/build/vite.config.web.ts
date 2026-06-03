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
  base: '/',
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
    },
  },

  plugins: [
    Vue(),
    AutoImport(autoImportOptionsCfg),
    Compression({
      algorithms: ['gzip'],
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    VitePWA(pwaCfg(buildRevision)),
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
          if (id.includes('node_modules')) {
            // 1. Ядро Vue (всегда нужно сразу)
            if (/[\\/]node_modules[\\/](?:vue|vue-router|pinia|@vueuse)[\\/]/.test(id)) {
              return 'vendor-core'
            }
            // 2. Специфичные тяжелые библиотеки (загрузятся только там, где нужны)
            if (id.includes('hanzi-writer')) {
              return 'vendor-hanzi'
            }
            if (id.includes('dompurify')) {
              return 'vendor-dompurify'
            }
            // 3. UI инструменты
            if (id.includes('@floating-ui') || id.includes('@iconify')) {
              return 'vendor-ui'
            }
            // 4. База данных и PWA
            if (id.includes('localforage') || id.includes('workbox')) {
              return 'vendor-storage'
            }

            // Все остальное
            return 'vendor-others'
          }
        },
      },
    },
  },
})
