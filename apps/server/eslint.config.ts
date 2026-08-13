import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  rules: {
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    'ts/no-explicit-any': 'error',
  },
  ignores: ['bun.lock', 'src_prompt.md'],
})
