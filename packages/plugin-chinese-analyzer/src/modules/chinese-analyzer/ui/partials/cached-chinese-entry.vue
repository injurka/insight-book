<script setup lang="ts">
import type { CachedChineseEntry } from '../../../../shared/lib/api'
import { shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { requestCachedChineseEntry } from '../../../../shared/lib/api'
import { detectInputLanguage } from '../../../../shared/lib/tone-utils'

interface Props {
  text: string
}

const props = defineProps<Props>()

const { locale, t } = useI18n()

const entry = shallowRef<CachedChineseEntry | null>(null)

watch([() => props.text.trim(), locale], ([text, language], _, onCleanup) => {
  entry.value = null

  if (!text || text.length > 100 || detectInputLanguage(text) !== 'zh')
    return

  const controller = new AbortController()
  const timer = setTimeout(async () => {
    try {
      const result = await requestCachedChineseEntry(text, language, controller.signal)

      if (controller.signal.aborted || !result)
        return

      const translation = result.source === 'dictionary'
        ? plainDictionaryTranslation(result.translation)
        : result.translation

      if (translation || result.transcription)
        entry.value = { ...result, translation }
    }
    catch {
      // This optional preview stays hidden if the cache is unavailable.
    }
  }, 300)

  onCleanup(() => {
    clearTimeout(timer)
    controller.abort()
  })
}, { immediate: true })

function plainDictionaryTranslation(translation: string): string {
  const template = document.createElement('template')
  template.innerHTML = translation
  template.content.querySelectorAll('script, style').forEach(node => node.remove())

  return template.content.textContent?.trim() ?? ''
}
</script>

<template>
  <aside v-if="entry" class="cached-chinese-entry">
    <div class="cache-source">
      {{ t(entry.source === 'dictionary' ? 'plugins.chinese-analyzer.cachedDictionaryEntry' : 'plugins.chinese-analyzer.cachedReaderEntry') }}
    </div>
    <div class="cache-content">
      <span v-if="entry.transcription" class="cache-pinyin">{{ entry.transcription }}</span>
      <span v-if="entry.translation">{{ entry.translation }}</span>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.cached-chinese-entry {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 9px 12px;
  border-inline-start: 2px solid var(--border-primary-color);
  border-radius: 6px;
  background: var(--bg-primary-color);
  overflow-wrap: anywhere;
}
.cache-source {
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
}
.cache-content {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 0.875rem;
}
.cache-pinyin {
  color: var(--fg-secondary-color);
}
</style>
