<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from '~/01.shared/composables/use-toast'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitImage } from '~/02.kit/atoms/kit-image/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import { useLibraryStore } from '~/05.modules/library/store/library.store'

const emit = defineEmits<{
  (e: 'editStats'): void
  (e: 'openSync'): void
  (e: 'openAppendChapter'): void
}>()

const libraryStore = useLibraryStore()
const authStore = useAuthStore()
const networkStore = useNetworkStore()
const toast = useToast()
const router = useRouter()
const { t } = useI18n()

function handleOpenSync() {
  if (networkStore.effectiveOffline) {
    toast.warn(t('network.needOnline'))

    return
  }

  emit('openSync')
}

function handleEditStats() {
  if (networkStore.effectiveOffline) {
    toast.warn(t('network.needOnline'))

    return
  }

  emit('editStats')
}

function handleOpenAppendChapter() {
  if (networkStore.effectiveOffline) {
    toast.warn(t('network.needOnline'))

    return
  }

  emit('openAppendChapter')
}

const coverInputRef = ref<HTMLInputElement | null>(null)

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

    router.replace({
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
      <KitBtn
        color="primary"
        icon="mdi:book-open-page-variant-outline"
        class="primary-action-btn full-width"
        @click="startReading"
      >
        {{ (libraryStore.currentBookInfo?.currentPage || 1) > 1 ? t('bookInfo.continueReading') : t('bookInfo.startReading') }}
      </KitBtn>

      <!-- Desktop secondary buttons -->
      <div class="desktop-secondary-actions">
        <KitBtn
          variant="tonal"
          color="secondary"
          class="full-width"
          icon="mdi:cloud-download-outline"
          @click="handleOpenSync"
        >
          {{ t('bookInfo.cacheAnalysis') }}
        </KitBtn>

        <KitBtn
          v-if="authStore.user && libraryStore.currentBookInfo?.userId === authStore.user?.id && libraryStore.currentBookInfo?.type === 'manga'"
          variant="tonal"
          color="accent"
          class="full-width"
          icon="mdi:image-plus"
          @click="handleOpenAppendChapter"
        >
          {{ t('bookInfo.addPages') }}
        </KitBtn>

        <KitBtn
          v-if="authStore.user && libraryStore.currentBookInfo?.userId === authStore.user?.id"
          variant="text"
          size="sm"
          class="edit-btn"
          @click="handleEditStats"
        >
          {{ t('bookInfo.edit') }}
        </KitBtn>
      </div>

      <!-- Mobile compact icon buttons -->
      <div class="mobile-secondary-actions">
        <KitTooltip :text="t('bookInfo.cacheAnalysis')" placement="top">
          <KitBtn
            variant="tonal"
            color="secondary"
            icon="mdi:cloud-download-outline"
            :title="t('bookInfo.cacheAnalysis')"
            :aria-label="t('bookInfo.cacheAnalysis')"
            @click="handleOpenSync"
          />
        </KitTooltip>

        <KitTooltip
          v-if="authStore.user && libraryStore.currentBookInfo?.userId === authStore.user?.id && libraryStore.currentBookInfo?.type === 'manga'"
          :text="t('bookInfo.addPages')"
          placement="top"
        >
          <KitBtn
            variant="tonal"
            color="accent"
            icon="mdi:image-plus"
            :title="t('bookInfo.addPages')"
            :aria-label="t('bookInfo.addPages')"
            @click="handleOpenAppendChapter"
          />
        </KitTooltip>

        <KitTooltip
          v-if="authStore.user && libraryStore.currentBookInfo?.userId === authStore.user?.id"
          :text="t('bookInfo.edit')"
          placement="top"
        >
          <KitBtn
            variant="tonal"
            color="secondary"
            icon="mdi:pencil-outline"
            :title="t('bookInfo.edit')"
            :aria-label="t('bookInfo.edit')"
            @click="handleEditStats"
          />
        </KitTooltip>
      </div>
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
  width: 100%;

  .full-width {
    width: 100%;
    justify-content: center;
  }

  .desktop-secondary-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    align-items: center;
  }

  .mobile-secondary-actions {
    display: none;
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

  @include media-down(md) {
    flex-direction: row;
    align-items: center;
    gap: 8px;

    .primary-action-btn {
      flex: 1;
      width: auto;
      min-width: 0;
    }

    .desktop-secondary-actions {
      display: none;
    }

    .mobile-secondary-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
  }
}
</style>
