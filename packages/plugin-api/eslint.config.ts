import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  formatters: true,
  node: false,
  // typescript: {
  //   tsconfigPath: 'tsconfig.json',
  // },
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
    // Цикломатическая сложность
    'complexity': ['error', { max: 10 }],

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

    'style/function-paren-newline': ['error', { minItems: 4 }],
    'style/object-curly-newline': ['error', {
      ExportDeclaration: { consistent: true, minProperties: 5, multiline: true },
      ObjectExpression: { consistent: true, minProperties: 5, multiline: true },
      ObjectPattern: { consistent: true, minProperties: 5, multiline: true },
    }],
    'style/object-property-newline': ['error', {
      allowAllPropertiesOnSameLine: true,
    }],
    'no-restricted-syntax': [
      'error',
      {
        message: 'Не пишите пропсы инлайн в defineProps<{ ... }>(). Выделяйте отдельный interface Props.',
        selector: 'CallExpression[callee.name="defineProps"] > TSTypeParameterInstantiation > TSTypeLiteral',
      },
    ],

    // Паттерн Early Return (Ранний возврат) — отсекает else после return
    'no-else-return': ['error', { allowElseIf: false }],

    // Находит неглубокие вложенные if внутри else и подталкивает к плоской структуре
    'no-lonely-if': 'error',

    // Гарантирует наличие явных блоков скобок {}, избавляя от багов ветвления
    'curly': 'off',
    'antfu/curly': 'error',
    'antfu/if-newline': 'error',

    // Предупреждает о бессмысленных 1-буквенных переменных (в книге: `d`, `c`, `p`)
    // 'id-length': ['warn', {
    //   exceptions: ['i', 'j', 'k', '_', 'x', 'y', 'z', 'a', 'b', 'e', 't'],
    //   min: 2,
    //   properties: 'never', // не проверяем ключи объектов (POS-теги, Record и т.п.)
    // }],

    // Фиксирует публичные контракты компонента через обязательное декларирование emits
    'vue/require-explicit-emits': 'error',

    // Форсирует использование только <script setup> для единообразия всего проекта
    'vue/component-api-style': ['error', ['script-setup']],

    // Предотвращает баги при опечатках работы с .value у ref()
    'vue/no-ref-as-operand': 'error',
  },
})
