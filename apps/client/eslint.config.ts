import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  formatters: true,
  node: false,
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
