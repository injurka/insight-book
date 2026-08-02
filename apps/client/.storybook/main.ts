import type { StorybookConfig } from '@storybook/vue3-vite'

/**
 * Функция для получения абсолютного пути к пакету.
 * Использует нативный `import.meta.resolve` и регулярные выражения вместо node:path и node:url.
 */
function getAbsolutePath(value: string): string {
  const resolved = import.meta.resolve(`${value}/package.json`)

  return resolved
    .replace(/^file:\/\//, '') // Удаляем протокол file:// если он есть
    .replace(/[/\\]package\.json$/, '') // Удаляем /package.json с конца пути
}

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  staticDirs: ['../public'],
  addons: [
    getAbsolutePath('@chromatic-com/storybook'),
    getAbsolutePath('@storybook/addon-vitest'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-onboarding'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/vue3-vite'),
    options: {
      builder: {
        viteConfigPath: 'build/vite.config.web.ts',
      },
    },
  },
}

export default config
