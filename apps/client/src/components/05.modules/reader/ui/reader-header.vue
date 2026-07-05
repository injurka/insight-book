<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitDropdown, KitTooltip } from '~/components/01.kit'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useReaderStore } from '../store/reader.store'
import ReaderParallelMenu from './partials/reader-parallel-menu.vue'
import ReaderSettingsMenu from './partials/reader-settings-menu.vue'

const props = withDefaults(defineProps<{
  isVisible?: boolean
}>(), {
  isVisible: true,
})

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()

const router = useRouter()

const parallelDropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)
const settingsDropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)

function goBack() {
  if (readerStore.currentBook?.id) {
    router.push(AppRoutePaths.Book.Info(readerStore.currentBook.id))
  }
  else {
    router.push(AppRoutePaths.Home)
  }
}

watch(() => props.isVisible, (visible) => {
  if (!visible) {
    settingsDropdownRef.value?.close()
    parallelDropdownRef.value?.close()
  }
})
</script>

<template>
  <header class="reader-header" :class="{ 'is-hidden': !isVisible }">
    <KitTooltip :text="t('reader.goBack')" placement="bottom">
      <KitBtn icon="mdi:arrow-left" variant="text" size="sm" @click="goBack" />
    </KitTooltip>

    <span class="book-title">{{ readerStore.currentBook?.title }}</span>
    <div class="spacer" />

    <KitDropdown ref="parallelDropdownRef" placement="bottom-end" width="300px" :close-on-content-click="false">
      <template #activator="{ props: dropdownProps }">
        <KitTooltip :text="t('reader.parallelReading')" placement="bottom">
          <KitBtn
            icon="mdi:view-split-vertical"
            variant="text"
            size="sm"
            :class="{ 'is-active-btn': settingsStore.parallelViewMode !== 'none' || dropdownProps?.isOpen }"
          />
        </KitTooltip>
      </template>
      <ReaderParallelMenu @start-analysis="parallelDropdownRef?.close()" />
    </KitDropdown>

    <KitTooltip :text="t('bookInfo.tableOfContents')" placement="bottom-end">
      <KitBtn icon="mdi:format-list-bulleted" variant="text" size="sm" @click="readerStore.tocOpen = true" />
    </KitTooltip>

    <KitDropdown ref="settingsDropdownRef" placement="bottom-end" :width="330" :close-on-content-click="false">
      <template #activator="{ props: dropdownProps }">
        <KitTooltip :text="t('settings.title')" placement="bottom">
          <div class="settings-btn-wrapper" @click.stop="dropdownProps.toggle()">
            <KitBtn
              icon="mdi:cog-outline"
              variant="text"
              size="sm"
              :class="{ 'is-active-btn': dropdownProps?.isOpen || analysisStore.isManualPageAnalysisActive }"
            />
            <span v-if="analysisStore.isManualPageAnalysisActive" class="blinking-dot" />
          </div>
        </KitTooltip>
      </template>
      <ReaderSettingsMenu @close-dropdown="settingsDropdownRef?.close()" />
    </KitDropdown>
  </header>
</template>

<style lang="scss" scoped>
.reader-header {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%) translateY(0);
  z-index: var(--z-header, 1100);

  background-color: rgba(var(--bg-secondary-color-rgb, 33, 38, 45), 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  border: 1px solid var(--border-secondary-color);
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);

  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  width: calc(100% - 32px);
  max-width: 800px;
  margin: 0;

  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;

  &.is-hidden {
    transform: translateX(-50%) translateY(calc(-100% - 24px));
    opacity: 0;
    pointer-events: none;
  }

  .book-title {
    font-weight: 500;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--fg-secondary-color);
    flex-shrink: 1;
    min-width: 0;
    margin-left: 8px;
  }

  .spacer {
    flex-grow: 1;
  }

  .is-active-btn {
    color: var(--fg-accent-color) !important;
  }
}

.settings-btn-wrapper {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.blinking-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  background-color: var(--fg-accent-color);
  border-radius: 50%;
  box-shadow: 0 0 4px var(--fg-accent-color);
  animation: pulse-dot 1.5s infinite;
  pointer-events: none;
}

@keyframes pulse-dot {
  0% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.3);
    opacity: 0.5;
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.spin-animation {
  :deep(.kit-btn-icon) {
    animation: spin 1s linear infinite;
  }
}

.pulse-animation {
  :deep(.kit-btn-icon) {
    animation: pulse-op 1.2s infinite;
    color: var(--fg-accent-color) !important;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-op {
  0% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
