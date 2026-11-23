import type { InsightBookPlugin } from '@injurka/insight-book-plugin-api'
import { normalizeAppLanguage } from '~/01.shared/lib/app-language'

interface BuiltInPluginContext {
  appLanguage: string
}

interface BuiltInPlugin {
  id: string
  icon: string
  load: () => Promise<{ default: InsightBookPlugin }>
  defaultEnabled?: (context: BuiltInPluginContext) => boolean
}

interface BuiltInPluginSettings extends BuiltInPluginContext {
  builtInPluginOverrides: Record<string, boolean>
  legacyDisabledPlugins: string[]
}

export const builtInPlugins: readonly BuiltInPlugin[] = [
  {
    id: 'grammar-rules',
    icon: 'mdi:school-outline',
    load: () => import('@injurka/insight-book-plugin-grammar-rules'),
  },
  {
    id: 'dialogue-trainer',
    icon: 'mdi:account-voice',
    load: () => import('@injurka/insight-book-plugin-dialogue-trainer'),
  },
  {
    id: 'chinese-analyzer',
    icon: 'mdi:ideogram-cjk-variant',
    load: () => import('@injurka/insight-book-plugin-chinese-analyzer'),
    defaultEnabled: ({ appLanguage }) => appLanguage !== 'zh',
  },
]

export function isBuiltInPluginEnabled(plugin: BuiltInPlugin, settings: BuiltInPluginSettings): boolean {
  const override = settings.builtInPluginOverrides[plugin.id]

  if (typeof override === 'boolean')
    return override

  if (settings.legacyDisabledPlugins.includes(plugin.id))
    return false

  const appLanguage = normalizeAppLanguage(settings.appLanguage) ?? settings.appLanguage

  return plugin.defaultEnabled?.({ appLanguage }) ?? true
}
