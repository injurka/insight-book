<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useToastStore } from '~/01.shared/store/toast.store'
import { KitToast } from '~/02.kit/molecules/kit-toast/ui'

const toastStore = useToastStore()

const { allMessages } = storeToRefs(toastStore)

const { remove } = toastStore
</script>

<template>
  <TransitionGroup
    tag="div"
    class="kit-toast-container"
    name="kit-toast-fade"
  >
    <KitToast
      v-for="msg in allMessages"
      :key="msg.id"
      :message="msg"
      @remove="remove(msg.id)"
    />
  </TransitionGroup>
</template>

<style lang="scss">
.kit-toast-container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: var(--z-toast, 1500);
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  width: 350px;

  @include media-down(sm) {
    left: 16px;
    width: auto;
  }
}

.kit-toast-fade-move,
.kit-toast-fade-enter-active,
.kit-toast-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.55, 0, 0.1, 1);
}

.kit-toast-fade-enter-from,
.kit-toast-fade-leave-to {
  opacity: 0;
  transform: scale(0.8) translateX(30px);
}

.kit-toast-fade-leave-active {
  position: absolute;
  width: 100%;
}
</style>
