import type { VitePWA } from 'vite-plugin-pwa'

export function pwaCfg(revision: string) {
  return {
    strategies: 'injectManifest',
    srcDir: 'workers/service',
    filename: 'sw.ts',
    registerType: 'prompt',
    base: '/',
    scope: '/',
    includeAssets: ['favicon.ico'],
    manifest: {
      name: 'InsightBook',
      short_name: 'InsightBook',
      description: 'Да здравствуют ваши заметки',
      theme_color: '#ffffff',
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
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      }, {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      }],
    },
    injectManifest: {
      globPatterns: ['**/*.{js,json,css,html,txt,svg,png,ico,webp,woff,woff2,ttf,eot,otf,wasm}'],
      globIgnores: ['emojis/**', 'manifest**.webmanifest'],
      maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      dontCacheBustURLsMatching: /\.\w{8}\./,
      additionalManifestEntries: [{
        url: '/',
        revision,
      }],
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  } satisfies Parameters<typeof VitePWA>[0]
}
