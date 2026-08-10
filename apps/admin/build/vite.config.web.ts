import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'
import { autoImportOptionsCfg } from './cfg/auto-import.ts'
import { iconsCfg } from './cfg/icons.ts'
import { visualizerPlugin } from './lib/helpers.ts'

export default defineConfig({
  root: fileURLToPath(new URL('../src', import.meta.url)),
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  envDir: fileURLToPath(new URL('../', import.meta.url)),

  resolve: {
    alias: {
      '~': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },

  plugins: [
    Vue(),
    vuetify({ autoImport: true }),
    AutoImport(autoImportOptionsCfg),
    Icons(iconsCfg),
    ...visualizerPlugin('admin'),
  ],

  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
  },
})
