import { fileURLToPath, URL } from 'node:url'
import { HstVue } from '@histoire/plugin-vue'
import vue from '@vitejs/plugin-vue'
import { defaultColors, defineConfig } from 'histoire'
import AutoImport from 'unplugin-auto-import/vite'

export default defineConfig({
  plugins: [
    HstVue(),
  ],
  setupFile: '/src/histoire.setup.ts',
  outDir: 'dist/docs',
  theme: {
    title: 'InsightBook Docs',
    colors: {
      primary: defaultColors.neutral,
    },
    defaultColorScheme: 'light',
    hideColorSchemeSwitch: true,
    storeColorScheme: false,
  },
  tree: {
    groups: [
      { id: 'top', title: 'О проекте' },
      { id: 'kit', title: '01. UI Kit' },
      { id: 'shared', title: '02. Shared' },
      { id: 'domain', title: '03. Domain' },
      { id: 'features', title: '04. Features' },
      { id: 'modules', title: '05. Modules' },
    ],
  },
  vite: {
    base: '/docs/',
    plugins: [
      vue(),
      AutoImport({
        imports: ['vue', 'vue-router', '@vueuse/core'],
        dts: false,
      }),
    ],
    resolve: {
      alias: [
        { find: '~', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      ],
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @use "~/assets/scss/_setup.scss" as *;
          `,
        },
      },
    },
  },
})
