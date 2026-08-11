<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { BOOK_COVER_TRANSITION_NAME, coverTransitionBookId } from '~/01.shared/lib/view-transitions'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitImage } from '~/02.kit/atoms/kit-image/ui'
import { useLibraryStore } from '~/05.modules/library/store/library.store'

const emit = defineEmits<{
  (e: 'editStats'): void
  (e: 'openSync'): void
  (e: 'openAppendChapter'): void
}>()

const libraryStore = useLibraryStore()
const authStore = useAuthStore()
const router = useRouter()
const { t } = useI18n()

const coverInputRef = ref<HTMLInputElement | null>(null)

// Цель shared-element перехода обложки из библиотеки (View Transitions API)
const coverTransitionStyle = computed(() =>
  libraryStore.currentBookInfo && coverTransitionBookId.value === libraryStore.currentBookInfo.id
    ? { viewTransitionName: BOOK_COVER_TRANSITION_NAME }
    : undefined)

function triggerCoverInput() {
  if (!authStore.user)
    return
  coverInputRef.value?.click()
}

function onCoverChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0 && libraryStore.currentBookInfo)
    libraryStore.updateBookCover(libraryStore.currentBookInfo.id, target.files[0])
}

async function startReading() {
  if (!authStore.user && !authStore.isSingleMode) {
    router.push(AppRoutePaths.SignIn)

    return
  }

  if (libraryStore.currentBookInfo) {
    if (libraryStore.currentBookInfo.currentPage === null)
      await libraryStore.startReadingPublicBook(libraryStore.currentBookInfo.id)

    router.push({
      path: AppRoutePaths.Reader,
      query: {
        bookId: libraryStore.currentBookInfo.id,
        page: libraryStore.currentBookInfo.currentPage || 1,
      },
    })
  }
}
</script>

<template>
  <div class="cover-col">
    <div
      class="cover-wrapper group"
      :class="{ 'is-editable': authStore.user && libraryStore.currentBookInfo?.userId === authStore.user?.id }"
      :style="coverTransitionStyle"
      @click="triggerCoverInput"
    >
      <KitImage
        :src="libraryStore.currentBookInfo?.localCoverUrl || libraryStore.currentBookInfo?.coverUrl"
        fallback-icon="mdi:book-open-blank-variant"
      />

      <div v-if="authStore.user && libraryStore.currentBookInfo?.userId === authStore.user?.id" class="cover-overlay">
        <Icon icon="mdi:image-edit" /> {{ t('bookInfo.changeCover') }}
      </div>
      <input
        ref="coverInputRef"
        type="file"
        accept="image/*"
        hidden
        @change="onCoverChange"
      >
    </div>

    <div class="action-buttons">
      <KitBtn color="primary" class="full-width" @click="startReading">
        {{ (libraryStore.currentBookInfo?.currentPage || 1) > 1 ? t('bookInfo.continueReading') : t('bookInfo.startReading') }}
      </KitBtn>

      <KitBtn
        variant="tonal"
        color="secondary"
        class="full-width"
        icon="mdi:cloud-download-outline"
        @click="emit('openSync')"
      >
        {{ t('bookInfo.cacheAnalysis') }}
      </KitBtn>

      <KitBtn
        v-if="authStore.user && libraryStore.currentBookInfo?.userId === authStore.user?.id && libraryStore.currentBookInfo?.type === 'manga'"
        variant="tonal"
        color="accent"
        class="full-width"
        icon="mdi:image-plus"
        @click="emit('openAppendChapter')"
      >
        {{ t('bookInfo.addPages') }}
      </KitBtn>

      <KitBtn
        v-if="authStore.user && libraryStore.currentBookInfo?.userId === authStore.user?.id"
        variant="text"
        size="sm"
        class="edit-btn"
        @click="emit('editStats')"
      >
        {{ t('bookInfo.edit') }}
      </KitBtn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cover-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  margin-bottom: 24px;

  :deep(.fallback-icon) {
    font-size: 6rem;
  }

  .cover-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    font-weight: 500;
    opacity: 0;
    transition: opacity 0.2s;
    border-radius: 12px;
    z-index: 10;
  }

  :deep(.kit-image) {
    img {
      object-fit: fill;
      transform: scale(1.01);
    }
  }

  &.is-editable {
    cursor: pointer;

    &:hover {
      :deep(.real-image) {
        transform: scale(1.05);
      }
      .cover-overlay {
        opacity: 1;
      }
    }
  }
}
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;

  .full-width {
    width: 100%;
    justify-content: center;
  }
  .edit-btn {
    opacity: 0.5;
    font-weight: 500;
    transition: opacity 0.2s;
    margin-top: 4px;
    &:hover {
      opacity: 0.9;
      background-color: transparent;
    }
  }
}
</style>
