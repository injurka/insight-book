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
    // Гарантирует порядок макросов вверху script setup
    'vue/define-macros-order': ['error', {
      order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots'],
    }],

    // Порядок тегов самого файла .vue
    'vue/block-order': ['error', {
      order: ['script', 'template', 'style'],
    }],

    // Форматирование HTML
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

    // Стилистика
    'style/function-paren-newline': ['error', { minItems: 4 }],
    'style/object-curly-newline': ['error', {
      ObjectExpression: { multiline: true, minProperties: 5, consistent: true },
      ObjectPattern: { multiline: true, minProperties: 5, consistent: true },
      ExportDeclaration: { multiline: true, minProperties: 5, consistent: true },
    }],
    'style/object-property-newline': ['error', {
      allowAllPropertiesOnSameLine: true,
    }],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.name="defineProps"] > TSTypeParameterInstantiation > TSTypeLiteral',
        message: 'Не пишите пропсы инлайн в defineProps<{ ... }>(). Выделяйте отдельный interface Props.',
      },
    ],
  },
})
