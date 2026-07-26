<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitInput } from '~/components/01.kit'

const props = defineProps<{
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', payload: { username: string, password: string }): void
}>()

const { t } = useI18n()
const username = ref('')
const password = ref('')

function handleSubmit() {
  if (!username.value || !password.value)
    return
  emit('submit', { username: username.value, password: password.value })
}
</script>

<template>
  <form class="whitelist-form" @submit.prevent="handleSubmit">
    <KitInput
      v-model="username"
      :placeholder="t('signIn.loginOrEmail')"
      autocomplete="username"
    />
    <KitInput
      v-model="password"
      type="password"
      :placeholder="t('signIn.password')"
      autocomplete="current-password"
    />
    <KitBtn
      type="submit"
      color="primary"
      class="submit-btn"
      :disabled="props.isLoading"
    >
      <Icon v-if="props.isLoading" icon="mdi:loading" class="spin" />
      <span>{{ t('signIn.loginBtn') }}</span>
    </KitBtn>
  </form>
</template>

<style scoped>
.whitelist-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
}

.submit-btn {
  width: 100%;
  height: 44px;
  border-radius: 10px;
  font-weight: 600;
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
