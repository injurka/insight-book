import { fileURLToPath, URL } from 'node:url'
import { federation } from '@module-federation/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('../../apps/client/src', import.meta.url)),
      '~plugin': fileURLToPath(new URL('./src', import.meta.url)),
      '@injurka/insight-book-plugin-api': fileURLToPath(new URL('../plugin-api/src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    ...(command === 'build'
      ? [
        federation({
          name: 'plugin_scroll_study',
          filename: 'remoteEntry.js',
          exposes: {
            './Plugin': './src/index.ts',
          },
          shared: {
            vue: { singleton: true },
            'vue-router': { singleton: true },
            'vue-i18n': { singleton: true },
            pinia: { singleton: true },
            '@injurka/insight-book-plugin-api': { singleton: true },
          },
          dts: false,
        }),
      ]
      : []),
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
}))
