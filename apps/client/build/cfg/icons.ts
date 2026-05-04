import type Icons from 'unplugin-icons/vite'
import { fileURLToPath, URL } from 'node:url'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'

export const iconsCfg: Parameters<typeof Icons>[0] = {
  compiler: 'vue3',
  autoInstall: true,
  customCollections: {
    custom: FileSystemIconLoader(
      fileURLToPath(new URL('../src/assets/svg', import.meta.url)),
      svg => svg.replace(/\.svg$/, ''),
    ),
  },
}
