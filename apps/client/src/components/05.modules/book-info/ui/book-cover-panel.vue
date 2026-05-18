<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn, KitImage } from '~/components/01.kit'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

const emit = defineEmits<{
  (e: 'editStats'): void
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
      <KitImage
        :src="libraryStore.currentBookInfo?.coverUrl"
        fallback-icon="mdi:book-open-blank-variant"
      />

      <div v-if="authStore.user" class="cover-overlay">
        <Icon icon="mdi:image-edit" /> Изменить
      </div>
      <input ref="coverInputRef" type="file" accept="image/*" hidden @change="onCoverChange">
    </div>

    <div class="action-buttons">
      <KitBtn color="primary" class="full-width" @click="startReading">
        {{ (libraryStore.currentBookInfo?.currentPage || 1) > 1 ? 'Продолжить чтение' : 'Начать чтение' }}
      </KitBtn>
      <KitBtn v-if="authStore.user" variant="text" size="sm" class="edit-btn" @click="emit('editStats')">
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
