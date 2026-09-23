import { fileURLToPath, URL } from 'node:url'
import { federation } from '@module-federation/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      '@injurka/insight-book-plugin-api': fileURLToPath(new URL('../plugin-api/src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    ...(command === 'build'
      ? [
        federation({
          name: 'plugin_grammar_tenses_cheatsheet',
          filename: 'remoteEntry.js',
          exposes: {
            './Plugin': './src/index.ts',
          },
          shared: {
            vue: { singleton: true },
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
    rollupOptions: {
      output: {
        assetFileNames: assetInfo => assetInfo.name?.endsWith('.css')
          ? 'assets/plugin.css'
          : 'assets/[name]-[hash][extname]',
      },
    },
  },
}))
