import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  rules: {
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
  },
  ignores: ['bun.lock'],
})
