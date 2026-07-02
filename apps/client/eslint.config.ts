// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  formatters: true,
  ignores: [
    '**/assets/**',
    '**/public/**',
    'auto-imports.d.ts',
    '**/vite-env.d.ts',
    'bun.lock',
    '**/src-tauri/**',
    '**/*.md',
  ],
})
