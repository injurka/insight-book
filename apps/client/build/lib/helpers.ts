import process from 'node:process'
import { visualizer } from 'rollup-plugin-visualizer'

function visualizerPlugin(type: 'renderer' | 'main') {
  return process.env[`VISUALIZER_${type.toUpperCase()}`] ? [visualizer({ open: true })] : []
}

export { visualizerPlugin }
