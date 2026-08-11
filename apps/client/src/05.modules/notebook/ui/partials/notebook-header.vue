<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
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
    <div class="header-top">
      <div class="title-group">
        <KitBtn icon="mdi:arrow-left" variant="text" @click="router.back()" />
        <h1>{{ t('notebook.title') }}</h1>
      </div>
      <GlobalActions hide-notebook />
    </div>

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
  margin-bottom: 24px;

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .title-group {
      display: flex;
      align-items: center;
      gap: 12px;

      h1 {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
        color: var(--fg-primary-color);
      }
    }
  }

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
