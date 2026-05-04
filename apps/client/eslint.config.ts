import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  formatters: true,
  ignores: [
    '**/assets/**',
    '**/public/**',
    'auto-imports.d.ts',
    'bun.lock',
  ],
})
