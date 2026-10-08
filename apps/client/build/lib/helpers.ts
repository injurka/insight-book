import type { BuildOptions, PluginOption } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * Плагин для визуализации бандла.
 * Запускается только если передана переменная окружения ANALYZE=true
 * Например: ANALYZE=true bun run build
 */
export function visualizerPlugin(title: string, outDir = 'dist'): PluginOption[] {
  const isAnalyze = process.env.ANALYZE === 'true' || process.env.ANALYZE === '1'

  if (isAnalyze) {
    return [
      visualizer({
        open: true,
        title: `Bundle Visualizer - ${title}`,
        filename: `${outDir}/stats-${title}.html`,
        gzipSize: true,
        brotliSize: true,
      }),
    ]
  }

  return []
}

export const onBuildWarning: NonNullable<NonNullable<BuildOptions['rolldownOptions']>['onwarn']> = (warning, warn) => {
  // Eruda bundles eval("require") in its Node-only crypto fallback.
  if (warning.code === 'EVAL' && /[/\\]eruda[/\\]eruda\.js$/.test(warning.id ?? ''))
    return

  warn(warning)
}
