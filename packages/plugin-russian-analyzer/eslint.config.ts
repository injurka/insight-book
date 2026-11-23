import { insightBookVueConfig } from '@injurka/insight-book-eslint-config/vue'

export default insightBookVueConfig({
  ignores: [
    '**/*.md',
    '**/dist/**',
    '**/assets/**',
    '**/public/**',
    '**/vite-env.d.ts',
    'auto-imports.d.ts',
  ],
})
