import type { Options as AutoImportOptions } from 'unplugin-auto-import/types'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import IconsResolver from 'unplugin-icons/resolver'

const currentDir = fileURLToPath(new URL('.', import.meta.url))
const root = (...paths: string[]) => resolve(currentDir, '../../', ...paths)

export const autoImportOptionsCfg: AutoImportOptions = {
  imports: [
    'vue',
    'vue-router',
    'pinia',
    { ofetch: ['ofetch'] },
  ],
  dirs: [
    root('src/01.shared/lib'),
    root('src/01.shared/types'),
    root('src/01.shared/composables'),
    root('src/01.shared/constants'),
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
  dts: root('src/01.shared/types/dts/auto-imports.d.ts'),
  vueTemplate: true,
  eslintrc: {
    enabled: true,
    filepath: root('.eslintrc-auto-import.json'),
  },
}
