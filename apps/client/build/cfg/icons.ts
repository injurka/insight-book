import type Icons from 'unplugin-icons/vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'

export const iconsCfg: Parameters<typeof Icons>[0] = {
  compiler: 'vue3',
  autoInstall: true,
  customCollections: {
    custom: FileSystemIconLoader(`${import.meta.dir}/../src/assets/svg`, svg => svg.replace(/\.svg$/, '')),
  },
}
