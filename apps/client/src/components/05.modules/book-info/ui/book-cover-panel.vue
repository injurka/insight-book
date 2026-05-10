<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
const router = useRouter()

const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'
const coverInputRef = ref<HTMLInputElement | null>(null)

function triggerCoverInput() {
  coverInputRef.value?.click()
}

function onCoverChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0 && store.currentBookInfo) {
    store.updateBookCover(store.currentBookInfo.id, target.files[0])
  }
}

function startReading() {
  if (store.currentBookInfo) {
    router.push({
      path: AppRoutePaths.Reader,
      query: { bookId: store.currentBookInfo.id, page: store.currentBookInfo.currentPage || 1 },
    })
  }
}
</script>

<template>
  <div class="cover-col">
    <div class="cover-wrapper group" @click="triggerCoverInput">
      <img
        v-if="store.currentBookInfo?.coverUrl"
        :src="store.currentBookInfo.coverUrl.startsWith('data:') ? store.currentBookInfo.coverUrl : `${BASE}${store.currentBookInfo.coverUrl}`"
        alt="Обложка"
      >
      <div v-else class="cover-placeholder">
        <Icon icon="mdi:book-open-blank-variant" class="placeholder-icon" />
      </div>
      <div class="cover-overlay">
        <Icon icon="mdi:image-edit" /> Изменить
      </div>
      <input ref="coverInputRef" type="file" accept="image/*" hidden @change="onCoverChange">
    </div>

    <div class="action-buttons">
      <KitBtn color="primary" class="full-width" @click="startReading">
        {{ (store.currentBookInfo?.currentPage || 1) > 1 ? 'Продолжить чтение' : 'Начать чтение' }}
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
  cursor: pointer;

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

  &:hover {
    img {
      transform: scale(1.05);
    }
    .cover-overlay {
      opacity: 1;
    }
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  .full-width {
    width: 100%;
  }
}
</style>
