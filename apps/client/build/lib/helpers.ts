import type { PluginOption } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * Плагин для визуализации бандла.
 * Запускается только если передана переменная окружения ANALYZE=true
 * Например: ANALYZE=true bun run build
 */
export function visualizerPlugin(title: string): PluginOption[] {
  const isAnalyze = process.env.ANALYZE === 'true' || process.env.ANALYZE === '1'

  if (isAnalyze) {
    return [
      visualizer({
        open: true,
        title: `Bundle Visualizer - ${title}`,
        filename: `dist/stats-${title}.html`,
        gzipSize: true,
        brotliSize: true,
      }),
    ]
  }

  return []
}
