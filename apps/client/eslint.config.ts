import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  formatters: true,
  node: false,
  ignores: [
    '**/assets/**',
    '**/public/**',
    '**/vite-env.d.ts',
    '**/src-tauri/**',
    '**/*.md',
    'auto-imports.d.ts',
    'bun.lock',
  ],
  rules: {
    'vue/max-attributes-per-line': ['error', {
      singleline: {
        max: 3,
      },
      multiline: {
        max: 1,
      },
    }],
    'vue/first-attribute-linebreak': ['error', {
      singleline: 'ignore',
      multiline: 'below',
    }],
    'vue/html-closing-bracket-newline': ['error', {
      singleline: 'never',
      multiline: 'always',
    }],
  },
})
