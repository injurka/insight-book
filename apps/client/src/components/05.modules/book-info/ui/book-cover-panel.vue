<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'
import { getMediaUrl } from '~/workers/service/lib/utils'

const emit = defineEmits<{
  (e: 'edit-stats'): void
}>()

const libraryStore = useLibraryStore()
const authStore = useAuthStore()
const router = useRouter()

const coverInputRef = ref<HTMLInputElement | null>(null)

function triggerCoverInput() {
  if (!authStore.user)
    return
  coverInputRef.value?.click()
}

function onCoverChange(e: Event) {
  const target = e.target as HTMLInputElement

  if (target.files && target.files.length > 0 && libraryStore.currentBookInfo) {
    libraryStore.updateBookCover(libraryStore.currentBookInfo.id, target.files[0])
  }
}

function startReading() {
  if (libraryStore.currentBookInfo) {
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
    <div class="cover-wrapper group" :class="{ 'is-editable': authStore.user }" @click="triggerCoverInput">
      <img
        v-if="libraryStore.currentBookInfo?.coverUrl"
        :src="libraryStore.currentBookInfo.coverUrl.startsWith('data:') ? libraryStore.currentBookInfo.coverUrl : `${getMediaUrl(libraryStore.currentBookInfo.coverUrl)}`"
        alt="Обложка"
      >
      <div v-else class="cover-placeholder">
        <Icon icon="mdi:book-open-blank-variant" class="placeholder-icon" />
      </div>
      <div v-if="authStore.user" class="cover-overlay">
        <Icon icon="mdi:image-edit" /> Изменить
      </div>
      <input ref="coverInputRef" type="file" accept="image/*" hidden @change="onCoverChange">
    </div>

    <div class="action-buttons">
      <KitBtn color="primary" class="full-width" @click="startReading">
        {{ (libraryStore.currentBookInfo?.currentPage || 1) > 1 ? 'Продолжить чтение' : 'Начать чтение' }}
      </KitBtn>
      <KitBtn v-if="authStore.user" variant="text" size="sm" class="edit-btn" @click="emit('edit-stats')">
        Редактировать
      </KitBtn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cover-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  background-color: var(--bg-tertiary-color);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  margin-bottom: 24px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }
  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-muted-color);
    .placeholder-icon {
      font-size: 5rem;
    }
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
  }

  &.is-editable {
    cursor: pointer;
    &:hover {
      img {
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
  gap: 12px;
  align-items: center;

  .full-width {
    width: 100%;
  }
  .edit-btn {
    opacity: 0.5;
    font-weight: 500;
    transition: opacity 0.2s;
    &:hover {
      opacity: 0.9;
      background-color: transparent;
    }
  }
}
</style>
