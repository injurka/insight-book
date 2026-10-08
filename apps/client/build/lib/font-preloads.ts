import type { Plugin } from 'vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const publicDir = resolve(import.meta.dirname, '../../public')
const weights = ['regular', 'medium', 'semibold']

export function criticalFontPaths(): string[] {
  return weights.flatMap((weight) => {
    const directory = `fonts/split/${weight}`
    const css = readFileSync(resolve(publicDir, directory, 'result-critical.css'), 'utf8')

    return Array.from(css.matchAll(/url\(["']?\.\/([^"')]+\.woff2)["']?\)/g), match => `${directory}/${match[1]}`)
  })
}

export function fontPreloads(): Plugin {
  let base = '/'

  return {
    name: 'critical-font-preloads',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler() {
        return criticalFontPaths().map(path => ({
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'font',
            type: 'font/woff2',
            href: `${base}${path}`,
            crossorigin: '',
          },
          injectTo: 'head-prepend' as const,
        }))
      },
    },
  }
}
