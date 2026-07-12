import type { Options as AutoImportOptions } from 'unplugin-auto-import/types'
import IconsResolver from 'unplugin-icons/resolver'

export const autoImportOptionsCfg: AutoImportOptions = {
  imports: [
    'vue',
    'vue-router',
    'pinia',
    '@vueuse/core',
  ],
  dirs: [
    './shared/lib/',
    './shared/types/',
    './shared/composables/',
    './shared/directives/',
    './shared/constants/',
  ],
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
  ],
  resolvers: [
    IconsResolver({
      prefix: 'Icon',
      customCollections: ['custom'],
      enabledCollections: ['mdi'],
    }),
  ],
  dts: './shared/types/dts/auto-imports.d.ts',
  vueTemplate: true,
  eslintrc: {
    enabled: true,
    filepath: './.eslintrc-auto-import.json',
  },
}
