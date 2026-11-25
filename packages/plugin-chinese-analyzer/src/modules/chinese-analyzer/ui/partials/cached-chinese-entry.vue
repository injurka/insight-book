<script setup lang="ts">
import type { CachedChineseEntry } from '../../../../shared/lib/api'
import { shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitSkeleton } from '~/02.kit/atoms/kit-skeleton/ui'
import { requestCachedChineseEntry } from '../../../../shared/lib/api'
import { detectInputLanguage } from '../../../../shared/lib/tone-utils'

interface Props {
  text: string
}

type LookupState
  = | { kind: 'loading' | 'empty' | 'unavailable' }
    | { kind: 'found', entry: CachedChineseEntry }

const props = defineProps<Props>()

const { locale, t } = useI18n()

const lookup = shallowRef<LookupState>({ kind: 'empty' })

watch([() => props.text.trim(), locale], ([text, language], _, onCleanup) => {
  if (!text || text.length > 100 || detectInputLanguage(text) !== 'zh') {
    lookup.value = { kind: 'empty' }

    return
  }

  lookup.value = { kind: 'loading' }
  const controller = new AbortController()
  const timer = setTimeout(async () => {
    try {
      const result = await requestCachedChineseEntry(text, language, controller.signal)

      if (controller.signal.aborted)
        return

      if (!result) {
        lookup.value = { kind: 'empty' }

        return
      }

      const translation = result.source === 'dictionary'
        ? plainDictionaryTranslation(result.translation)
        : result.translation

      lookup.value = translation || result.transcription
        ? { kind: 'found', entry: { ...result, translation } }
        : { kind: 'empty' }
    }
    catch {
      if (!controller.signal.aborted)
        lookup.value = { kind: 'unavailable' }
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
  <aside class="cached-chinese-entry">
    <div class="cache-source">
      {{ t(lookup.kind === 'found' && lookup.entry.source === 'reader' ? 'plugins.chinese-analyzer.cachedReaderEntry' : 'plugins.chinese-analyzer.cachedDictionaryEntry') }}
    </div>
    <div class="cache-content" role="status" :tabindex="lookup.kind === 'found' ? 0 : undefined">
      <template v-if="lookup.kind === 'found'">
        <span v-if="lookup.entry.transcription" class="cache-pinyin">{{ lookup.entry.transcription }}</span>
        <span v-if="lookup.entry.translation">{{ lookup.entry.translation }}</span>
      </template>
      <div v-else-if="lookup.kind === 'loading'" class="cache-message">
        {{ t('plugins.chinese-analyzer.cachedEntryLoading') }}
        <KitSkeleton width="60%" height="0.55em" aria-hidden="true" />
      </div>
      <span v-else class="cache-message">
        {{ t(lookup.kind === 'unavailable' ? 'plugins.chinese-analyzer.cachedEntryUnavailable' : 'plugins.chinese-analyzer.cachedEntryEmpty') }}
      </span>
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
  block-size: 2.9em;
  overflow-y: auto;
  font-size: 0.875rem;
  line-height: 1.45;
}
.cache-pinyin {
  margin-inline-end: 0.75em;
}
.cache-pinyin,
.cache-message {
  color: var(--fg-secondary-color);
}

@media (prefers-reduced-motion: reduce) {
  .cache-message :deep(.kit-skeleton--wave)::after {
    animation: none;
  }
}
</style>
