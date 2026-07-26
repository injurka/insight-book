<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitInput } from '~/components/01.kit'

const props = defineProps<{
  isLoading?: boolean
  isCodeSent?: boolean
}>()

const emit = defineEmits<{
  (e: 'sendCode', email: string): void
  (e: 'register', payload: { email: string, code: string, password: string }): void
}>()

const { t } = useI18n()
const email = ref('')
const code = ref('')
const password = ref('')

function handleSubmit() {
  if (props.isCodeSent) {
    if (!email.value || !code.value || !password.value)
      return
    emit('register', { email: email.value, code: code.value, password: password.value })
  }
  else {
    if (!email.value)
      return
    emit('sendCode', email.value)
  }
}
</script>

<template>
  <form class="whitelist-form" @submit.prevent="handleSubmit">
    <KitInput
      v-model="email"
      type="email"
      placeholder="Email"
      autocomplete="email"
      :disabled="props.isCodeSent"
    />

    <template v-if="props.isCodeSent">
      <KitInput
        v-model="code"
        :placeholder="t('signIn.verificationCode')"
        autocomplete="one-time-code"
      />
      <KitInput
        v-model="password"
        type="password"
        :placeholder="t('signIn.createPassword')"
        autocomplete="new-password"
      />
    </template>

    <KitBtn
      type="submit"
      color="primary"
      class="submit-btn"
      :disabled="props.isLoading"
    >
      <Icon v-if="props.isLoading" icon="mdi:loading" class="spin" />
      <span>{{ props.isCodeSent ? t('signIn.registerBtn') : t('signIn.getCode') }}</span>
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
