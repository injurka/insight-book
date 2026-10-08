<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitPageHeader } from '~/02.kit/molecules/kit-page-header/ui'
import { GlobalActions } from '~/04.features/global-actions'

interface Props {
  searchQuery: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'startRandomPractice': []
}>()

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <header class="notebook-header">
    <KitPageHeader :title="t('notebook.title')" :subtitle="t('notebook.headerSubtitle')">
      <template #navigation>
        <KitBtn icon="mdi:arrow-left" variant="text" @click="router.back()" />
      </template>
      <template #actions>
        <GlobalActions hide-notebook />
      </template>
    </KitPageHeader>

    <div class="header-bottom">
      <div class="search-wrapper">
        <KitInput
          :model-value="props.searchQuery"
          :placeholder="t('notebook.searchPlaceholder')"
          icon="mdi:magnify"
          color="secondary"
          class="search-input"
          clearable
          @update:model-value="emit('update:searchQuery', String($event ?? ''))"
        />
      </div>
      <KitBtn
        icon="mdi:gamepad-variant"
        variant="tonal"
        color="success"
        @click="emit('startRandomPractice')"
      >
        {{ t('notebook.practiceRandom') }}
      </KitBtn>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.notebook-header {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 24px;

  .header-bottom {
    display: flex;
    gap: 12px;
    align-items: center;

    .search-wrapper {
      flex-grow: 1;
    }
  }
}
</style>
