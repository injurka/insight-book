<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { KitBtn, KitInput, KitSelect } from '~/02.kit'
import { GlobalActions } from '~/04.features/global-actions'

interface Props {
  langOptions: Array<{ label: string, value: string }>
  tagOptions?: Array<{ label: string, value: string }>
  showTagFilter?: boolean
  showMenuBtn?: boolean
}

withDefaults(defineProps<Props>(), {
  showTagFilter: false,
  showMenuBtn: true,
})

const emit = defineEmits<{
  (e: 'openMenu'): void
  (e: 'openUploadModal'): void
}>()

const search = defineModel<string>('search', { required: true })
const lang = defineModel<string>('lang', { required: true })
const tag = defineModel<string>('tag')

const authStore = useAuthStore()
const { t } = useI18n()
const isMobileFiltersOpen = ref(false)
</script>

<template>
  <header class="library-header">
    <div class="header-top">
      <div class="header-title-wrap">
        <KitBtn
          v-if="showMenuBtn"
          class="mobile-menu-btn"
          icon="mdi:menu"
          variant="text"
          @click="emit('openMenu')"
        />
        <div class="header-title">
          <h1>Insight Book</h1>
          <p>{{ t('library.headerSubtitle') }}</p>
        </div>
      </div>

      <GlobalActions />
    </div>

    <div class="header-bottom">
      <div class="search-wrapper">
        <KitInput
          v-model="search"
          :placeholder="t('library.searchPlaceholder')"
          icon="mdi:magnify"
          color="secondary"
          size="md"
          class="search-input"
        />

        <KitBtn
          class="mobile-filter-btn"
          :icon="isMobileFiltersOpen ? 'mdi:chevron-up' : 'mdi:tune-variant'"
          variant="tonal"
          color="secondary"
          @click="isMobileFiltersOpen = !isMobileFiltersOpen"
        />
      </div>

      <div class="filters-and-actions" :class="{ 'is-open': isMobileFiltersOpen }">
        <KitSelect
          v-if="showTagFilter && tagOptions"
          v-model="tag!"
          :options="tagOptions"
          icon="mdi:tag-outline"
          size="md"
          color="secondary"
          class="filter-select tag-select"
        />

        <KitSelect
          v-model="lang"
          :options="langOptions"
          icon="mdi:translate"
          size="md"
          color="secondary"
          :aria-label="t('library.selectLanguage')"
          class="filter-select lang-select"
        />

        <div class="spacer" />

        <div class="header-actions">
          <KitBtn
            v-if="authStore.user"
            icon="mdi:upload"
            color="primary"
            @click="emit('openUploadModal')"
          >
            {{ t('library.addBook') }}
          </KitBtn>
        </div>
      </div>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.library-header {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 24px;

  .header-top {
    display: flex;
    justify-content: space-between;

    .header-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .mobile-menu-btn {
      display: none;
    }

    .header-title {
      h1 {
        font-size: 2.2rem;
        margin: 0 0 8px 0;
        color: var(--fg-primary-color);
        line-height: 1.1;
      }
      p {
        margin: 0;
        color: var(--fg-secondary-color);
        font-size: 1rem;
      }

      @include media-down(sm) {
        h1 {
          font-size: 1.6rem;
          margin: 0;
        }
        p {
          display: none;
        }
      }
    }

    @include media-down(md) {
      .mobile-menu-btn {
        display: flex;
      }
    }
  }

  .header-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;

    .search-wrapper {
      width: 100%;
      max-width: 400px;
      display: flex;
      gap: 8px;

      .search-input {
        width: 100%;
      }

      .mobile-filter-btn {
        display: none;
      }
    }

    .filters-and-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-grow: 1;

      .filter-select {
        flex-shrink: 0;
        &.lang-select {
          width: 160px;
        }
        &.tag-select {
          width: 200px;
        }
      }

      .spacer {
        flex-grow: 1;
      }

      .header-actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }
    }

    @include media-down(sm) {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;

      .search-wrapper {
        max-width: 100%;

        .mobile-filter-btn {
          display: inline-flex;
          flex-shrink: 0;
        }
      }

      .filters-and-actions {
        display: none;
        flex-direction: column;
        align-items: stretch;
        background-color: var(--bg-secondary-color);
        padding: 16px;
        border-radius: 12px;
        border: 1px solid var(--border-secondary-color);
        gap: 12px;

        &.is-open {
          display: flex;
          animation: slideDown 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .spacer {
          display: none;
        }

        .filter-select {
          width: 100% !important;
        }

        .header-actions {
          width: 100%;
          flex-direction: row;

          .kit-btn {
            flex: 1;
            justify-content: center;
          }
        }
      }
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
