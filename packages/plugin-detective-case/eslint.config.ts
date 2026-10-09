import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  formatters: true,
  node: false,
  ignores: ['**/*.md', 'dist/**'],
})
