import antfu from '@antfu/eslint-config'

export interface InsightBookServerConfigOptions {
  ignores?: string[]
}

export function insightBookServerConfig({ ignores = [] }: InsightBookServerConfigOptions = {}) {
  return antfu({
    typescript: true,
    formatters: true,
    rules: {
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
      'ts/no-explicit-any': 'error',
      'style/padding-line-between-statements': ['error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'never', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'switch', 'try'] },
        { blankLine: 'always', prev: ['if', 'for', 'while', 'switch', 'try'], next: '*' },
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
      'style/function-paren-newline': ['error', { minItems: 4 }],
      'style/object-curly-newline': ['error', {
        ExportDeclaration: { consistent: true, minProperties: 5, multiline: true },
        ObjectExpression: { consistent: true, minProperties: 5, multiline: true },
        ObjectPattern: { consistent: true, minProperties: 5, multiline: true },
      }],
      'style/object-property-newline': ['error', {
        allowAllPropertiesOnSameLine: true,
      }],
      'no-else-return': ['error', { allowElseIf: false }],
      'no-lonely-if': 'error',
      curly: 'off',
      'antfu/curly': 'error',
      'antfu/if-newline': 'error',
    },
    ignores,
  })
}
