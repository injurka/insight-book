<script setup lang="ts">
import type { SubscriptionTier } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitInput from '~/02.kit/atoms/kit-input.vue'
import KitFormGroup from '~/02.kit/molecules/kit-form-group.vue'
import KitSelect from '~/02.kit/molecules/kit-select.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import { DEFAULT_SUBSCRIPTION_TIERS, formatTierOptions, formatTokens, getTierDefaults } from '~/03.domain/user'

const { admin } = useRepos()
const router = useRouter()

const tiers = ref<SubscriptionTier[]>(DEFAULT_SUBSCRIPTION_TIERS)

const form = reactive({
  username: '',
  password: '',
  role: 'user',
  email: '',
  subscriptionTier: 'free',
  tokenLimit: 100000,
  bookLimit: 3,
})

const showCustomLimits = ref(false)
const loading = ref(false)
const error = ref('')
const success = ref(false)

const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
]

const tierOptions = computed(() => formatTierOptions(tiers.value))

watch(
  () => form.subscriptionTier,
  (newTier) => {
    const defaults = getTierDefaults(newTier, tiers.value)
    form.tokenLimit = defaults.tokenLimit
    form.bookLimit = defaults.bookLimit
  },
)

async function loadTiers() {
  try {
    const data = await admin.getSubscriptionTiers()
    if (data && data.length) {
      tiers.value = data
    }
  }
  catch {
    // Fallback to static default tiers on network error
  }
}

onMounted(() => loadTiers())

async function handleSubmit() {
  if (!form.username || !form.password)
    return
  error.value = ''
  loading.value = true
  try {
    await admin.createUser({ ...form, email: form.email || null })
    success.value = true
    setTimeout(() => router.push({ name: 'users' }), 1000)
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally { loading.value = false }
}
</script>

<template>
  <div>
    <h1 class="user-create-form__title">
      <Icon icon="mdi:plus" class="user-create-form__title-icon" />
      <span>Создать пользователя</span>
    </h1>
    <form class="user-create-form__card" @submit.prevent="handleSubmit">
      <KitFormGroup>
        <template #label>
          Имя пользователя *
        </template>
        <KitInput v-model="form.username" placeholder="username" autocomplete="username" />
      </KitFormGroup>

      <KitFormGroup>
        <template #label>
          Пароль *
        </template>
        <KitInput
          v-model="form.password"
          type="password"
          placeholder="Минимум 6 символов"
          autocomplete="new-password"
        />
      </KitFormGroup>

      <KitFormGroup>
        <template #label>
          Email
        </template>
        <KitInput
          v-model="form.email"
          type="email"
          placeholder="user@example.com"
          autocomplete="email"
        />
      </KitFormGroup>

      <KitFormGroup>
        <template #label>
          Роль
        </template>
        <KitSelect v-model="form.role" :options="roleOptions" />
      </KitFormGroup>

      <KitFormGroup>
        <template #label>
          Подписка
        </template>
        <KitSelect v-model="form.subscriptionTier" :options="tierOptions" />
      </KitFormGroup>

      <div class="user-create-form__limits-section">
        <button
          type="button"
          class="user-create-form__limits-toggle"
          @click="showCustomLimits = !showCustomLimits"
        >
          <Icon :icon="showCustomLimits ? 'mdi:chevron-down' : 'mdi:chevron-right'" />
          <span>Настроить кастомные лимиты</span>
          <span class="user-create-form__limits-hint">
            ({{ formatTokens(form.tokenLimit) }} токенов, {{ form.bookLimit }} книг)
          </span>
        </button>

        <div v-if="showCustomLimits" class="user-create-form__limits-fields">
          <KitFormGroup>
            <template #label>
              Кастомный лимит токенов
            </template>
            <KitInput v-model.number="form.tokenLimit" type="number" />
          </KitFormGroup>
          <KitFormGroup>
            <template #label>
              Кастомный лимит книг
            </template>
            <KitInput v-model.number="form.bookLimit" type="number" />
          </KitFormGroup>
        </div>
      </div>

      <KitBtn type="submit" variant="success" :disabled="loading">
        <Icon v-if="!loading" icon="mdi:check" />
        <span>{{ loading ? 'Создание...' : 'Создать' }}</span>
      </KitBtn>
      <KitError v-if="error" :message="error" />
      <div v-if="success" class="user-create-form__success">
        Пользователь создан! Перенаправление...
      </div>
    </form>
  </div>
</template>

<style scoped>
.user-create-form__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-create-form__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}
.user-create-form__card {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
}
.user-create-form__limits-section {
  margin-bottom: 20px;
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 6px;
  background: var(--bg-primary-color, rgba(255, 255, 255, 0.4));
  overflow: hidden;
}
.user-create-form__limits-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-primary-color, #4a443c);
  text-align: left;
}
.user-create-form__limits-toggle:hover {
  background: var(--bg-hover-color, rgba(0, 0, 0, 0.04));
}
.user-create-form__limits-hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  font-weight: normal;
}
.user-create-form__limits-fields {
  padding: 14px;
  border-top: 1px solid var(--border-secondary-color, #d9d1c7);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.user-create-form__success {
  color: var(--fg-success-color, #4b8266);
  font-size: 14px;
  margin-top: 12px;
}
</style>
