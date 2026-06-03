import type { PluginOption } from 'vite'
import process from 'node:process'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * Плагин для визуализации бандла.
 * Запускается только если передана переменная окружения ANALYZE=true
 * Например: ANALYZE=true npm run build
 */
export function visualizerPlugin(title: string): PluginOption[] {
  if (process.env.ANALYZE === 'true' || process.env.ANALYZE === '1') {
    return [
      visualizer({
        open: true, 
        title: `Bundle Visualizer - ${title}`,
        filename: `dist/stats-${title}.html`, 
        gzipSize: true,
        brotliSize: true,
      }) as unknown as PluginOption,
    ]
  }

  return []
}
