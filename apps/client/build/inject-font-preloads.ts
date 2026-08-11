/* eslint-disable no-console */
/**
 * Post-build: injects <link rel="preload"> for critical woff2 font files
 * into the built index.html.
 *
 * Scans dist/fonts/split/<*>/result-critical.css to extract woff2 URLs,
 * then adds preload links right before the font CSS stylesheet links.
 *
 * Run after `vite build`: bun run build && bun run build/inject-font-preloads.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(import.meta.dirname, '..', 'dist')
const INDEX_HTML = join(DIST, 'index.html')
const FONTS_DIR = join(DIST, 'fonts', 'split')

// Weight variants we use
const WEIGHTS = ['regular', 'medium', 'semibold']

function extractWoff2Urls(cssPath: string): string[] {
  const css = readFileSync(cssPath, 'utf-8')
  const urls: string[] = []
  // Match url("./<hash>.woff2") inside @font-face blocks
  const re = /url\("\.\/([^"]+\.woff2)"\)/g
  let match

  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(css)) !== null) {
    urls.push(match[1])
  }

  return urls
}

// Gather all critical woff2 files
const preloadTags: string[] = []
for (const weight of WEIGHTS) {
  const cssFile = join(FONTS_DIR, weight, 'result-critical.css')
  try {
    const woff2Files = extractWoff2Urls(cssFile)
    for (const woff2 of woff2Files) {
      const url = `/fonts/split/${weight}/${woff2}`
      preloadTags.push(`    <link rel="preload" as="font" type="font/woff2" href="${url}" crossorigin />`)
    }

    console.log(`  ${weight}: ${woff2Files.length} woff2 files`)
  }
  catch {
    console.warn(`  ${weight}: result-critical.css not found, skipping`)
  }
}

if (preloadTags.length === 0) {
  console.log('No critical woff2 files found — nothing to inject.')
  process.exit(0)
}

// Inject into index.html — insert before the font CSS <link> tags
let html = readFileSync(INDEX_HTML, 'utf-8')

// Find the first font CSS link and insert preloads before it
const fontCssMarker = '<link rel="stylesheet" href="/fonts/split/'
const insertPos = html.indexOf(fontCssMarker)

if (insertPos === -1) {
  console.warn('Font CSS link not found in index.html — preloads NOT injected.')
  process.exit(0)
}

const preloadBlock = `${preloadTags.join('\n')}\n`
html = html.slice(0, insertPos) + preloadBlock + html.slice(insertPos)

writeFileSync(INDEX_HTML, html)
console.log(`\nInjected ${preloadTags.length} font preload links into dist/index.html`)
