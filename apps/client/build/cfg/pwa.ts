import type { VitePWA } from 'vite-plugin-pwa'
import { criticalFontPaths } from '../lib/font-preloads.ts'

export function pwaCfg(revision: string) {
  return {
    strategies: 'injectManifest',
    srcDir: '01.shared/workers/service',
    filename: 'sw.ts',
    registerType: 'prompt',
    base: '/',
    scope: '/',
    includeAssets: ['favicon.ico'],
    manifest: {
      name: 'InsightBook',
      short_name: 'InsightBook',
      description: 'Да здравствуют ваши заметки',
      theme_color: '#0d1117',
      background_color: '#0d1117',
      lang: 'ru',
      icons: [{
        src: 'pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      }, {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      }, {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      }],
    },
    injectManifest: {
      buildPlugins: {
        vite: [{
          name: 'pwa-service-worker-code-splitting',
          config(config) {
            // vite-plugin-pwa still uses the deprecated Rolldown option.
            const output = config.build?.rollupOptions?.output

            for (const options of Array.isArray(output) ? output : [output]) {
              if (options?.inlineDynamicImports === true) {
                delete options.inlineDynamicImports
                options.codeSplitting = false
              }
            }
          },
        }],
      },
      globPatterns: ['**/*.{js,json,css,html,txt,svg,png,ico,webp,woff,woff2,ttf,eot,otf,wasm}'],
      globIgnores: ['emojis/**', 'manifest**.webmanifest', 'fonts/**/*.woff2', 'fonts/**/*.html'],
      maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      dontCacheBustURLsMatching: /\.\w{8}\./,
      additionalManifestEntries: [...criticalFontPaths().map(url => ({ url, revision: null })), {
        url: '/',
        revision,
      }],
    },
    devOptions: {
      enabled: false,
      type: 'module',
      navigateFallback: 'index.html',
    },
  } satisfies Parameters<typeof VitePWA>[0]
}
