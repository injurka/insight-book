import { insightBookVueConfig } from '@injurka/insight-book-eslint-config/vue'

export default insightBookVueConfig({
  ignores: [
    '**/dist-tauri/**',
    '**/assets/**',
    '**/public/**',
    '**/vite-env.d.ts',
    '**/src-tauri/**',
    '**/*.md',
    'auto-imports.d.ts',
    'bun.lock',
  ],
})
