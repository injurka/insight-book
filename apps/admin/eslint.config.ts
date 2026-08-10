import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  formatters: true,
  node: false,
  ignores: [
    '**/assets/**',
    '**/vite-env.d.ts',
    '**/auto-imports.d.ts',
    'bun.lock',
  ],
  rules: {
    'no-alert': 'off',
    'ts/no-explicit-any': 'error',
    'style/padding-line-between-statements': [
      'error',
      { blankLine: 'always', prev: '*', next: 'return' },
      { blankLine: 'always', prev: '*', next: 'function' },
      { blankLine: 'always', prev: 'block-like', next: '*' },
    ],
    'complexity': ['error', { max: 10 }],
    'vue/define-macros-order': ['error', {
      order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots'],
    }],
    'vue/block-order': ['error', {
      order: ['script', 'template', 'style'],
    }],
    'vue/max-attributes-per-line': ['error', {
      singleline: { max: 3 },
      multiline: { max: 1 },
    }],
    'vue/first-attribute-linebreak': ['error', {
      singleline: 'ignore',
      multiline: 'below',
    }],
    'vue/html-closing-bracket-newline': ['error', {
      singleline: 'never',
      multiline: 'always',
    }],
    'no-restricted-syntax': [
      'error',
      {
        message: 'Не пишите пропсы инлайн в defineProps<{ ... }>(). Выделяйте отдельный interface Props.',
        selector: 'CallExpression[callee.name="defineProps"] > TSTypeParameterInstantiation > TSTypeLiteral',
      },
    ],
    'no-else-return': ['error', { allowElseIf: false }],
    'no-lonely-if': 'error',
    'curly': 'off',
    'antfu/curly': 'error',
    'antfu/if-newline': 'error',
    'vue/require-explicit-emits': 'error',
    'vue/component-api-style': ['error', ['script-setup']],
    'vue/no-ref-as-operand': 'error',
  },
})
