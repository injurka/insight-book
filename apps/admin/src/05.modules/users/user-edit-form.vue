<script setup lang="ts">
import type { SubscriptionTier, UserDetail } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitInput from '~/02.kit/atoms/kit-input.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitFormGroup from '~/02.kit/molecules/kit-form-group.vue'
import KitSelect from '~/02.kit/molecules/kit-select.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import { DEFAULT_SUBSCRIPTION_TIERS, formatTierOptions, formatTokens, getTierDefaults } from '~/03.domain/user'

interface Props {
  id: string
}

const props = defineProps<Props>()

const { admin } = useRepos()
const router = useRouter()

const tiers = ref<SubscriptionTier[]>(DEFAULT_SUBSCRIPTION_TIERS)
const user = ref<UserDetail | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const showCustomLimits = ref(false)

const form = reactive({
  username: '',
  role: 'user',
  email: '',
  subscriptionTier: 'free',
  tokenLimit: 100000,
  bookLimit: 3,
  password: '',
})

const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
]

const tierOptions = computed(() => formatTierOptions(tiers.value))

function onTierSelect(newTier: string) {
  form.subscriptionTier = newTier
  const defaults = getTierDefaults(newTier, tiers.value)
  form.tokenLimit = defaults.tokenLimit
  form.bookLimit = defaults.bookLimit
}

function populateForm(data: UserDetail) {
  form.username = data.username
  form.role = data.role
  form.email = data.email || ''
  form.subscriptionTier = data.subscriptionTier
  form.tokenLimit = data.tokenLimit ?? 100000
  form.bookLimit = data.bookLimit ?? 3
}

function addIfChanged(patch: Record<string, unknown>, key: string, newVal: unknown, oldVal: unknown) {
  if (newVal !== oldVal)
    patch[key] = newVal
}

function buildPatch(): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const u = user.value

  if (!u)
    return patch

  addIfChanged(patch, 'username', form.username, u.username)
  addIfChanged(patch, 'role', form.role, u.role)
  addIfChanged(patch, 'email', form.email || null, u.email ?? '')
  addIfChanged(patch, 'subscriptionTier', form.subscriptionTier, u.subscriptionTier)
  addIfChanged(patch, 'tokenLimit', form.tokenLimit, u.tokenLimit)
  addIfChanged(patch, 'bookLimit', form.bookLimit, u.bookLimit)
  if (form.password)
    patch.password = form.password

  return patch
}

async function load() {
  loading.value = true
  try {
    const [userData, tiersData] = await Promise.allSettled([
      admin.getUser(Number(props.id)),
      admin.getSubscriptionTiers(),
    ])

    if (tiersData.status === 'fulfilled' && tiersData.value.length) {
      tiers.value = tiersData.value
    }

    if (userData.status === 'fulfilled') {
      user.value = userData.value
      populateForm(userData.value)
    }
    else {
      throw userData.reason
    }
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally { loading.value = false }
}

async function handleSave() {
  saving.value = true
  error.value = ''
  success.value = ''

  try {
    const patch = buildPatch()

    if (Object.keys(patch).length === 0) {
      error.value = 'Нет изменений для сохранения'

      return
    }

    await admin.updateUser(Number(props.id), patch)
    success.value = 'Сохранено!'
    await load()
    form.password = ''
    setTimeout(() => {
      success.value = ''
    }, 2000)
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally { saving.value = false }
}

async function handleDelete() {
  if (!confirm(`Удалить пользователя "${user.value?.username}"?`))
    return
  try {
    await admin.deleteUser(Number(props.id))
    router.push({ name: 'users' })
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}

onMounted(() => load())
</script>

<template>
  <div>
    <div class="user-edit-form__back">
      <RouterLink to="/users" class="user-edit-form__back-link">
        <Icon icon="mdi:arrow-left" />
        <span>Назад</span>
      </RouterLink>
      <h1 class="user-edit-form__title">
        <Icon icon="mdi:pencil" class="user-edit-form__title-icon" />
        <span>{{ user?.username || '...' }}</span>
      </h1>
    </div>

    <div v-if="loading" class="user-edit-form__card">
      <KitSkeleton type="form-item" :count="5" />
    </div>

    <KitError v-if="error" :message="error" />

    <div v-if="!loading && user" class="user-edit-form__card">
      <KitFormGroup>
        <template #label>
          ID
        </template>
        <div class="user-edit-form__readonly">
          {{ user.id }}
        </div>
      </KitFormGroup>
      <KitFormGroup>
        <template #label>
          Создан
        </template>
        <div class="user-edit-form__readonly">
          {{ new Date(user.createdAt).toLocaleString('ru-RU') }}
        </div>
      </KitFormGroup>
      <KitFormGroup>
        <template #label>
          Использовано токенов
        </template>
        <div class="user-edit-form__readonly">
          {{ user.usedTokens?.toLocaleString() || 0 }}
        </div>
      </KitFormGroup>
      <KitFormGroup>
        <template #label>
          Использовано книг (период)
        </template>
        <div class="user-edit-form__readonly">
          {{ user.usedBooks || 0 }}
        </div>
      </KitFormGroup>

      <KitFormGroup>
        <template #label>
          Имя пользователя
        </template>
        <KitInput v-model="form.username" />
      </KitFormGroup>
      <KitFormGroup>
        <template #label>
          Email
        </template>
        <KitInput v-model="form.email" type="email" placeholder="user@example.com" />
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
        <KitSelect
          :model-value="form.subscriptionTier"
          :options="tierOptions"
          @update:model-value="onTierSelect"
        />
      </KitFormGroup>

      <div class="user-edit-form__limits-section">
        <button
          type="button"
          class="user-edit-form__limits-toggle"
          @click="showCustomLimits = !showCustomLimits"
        >
          <Icon :icon="showCustomLimits ? 'mdi:chevron-down' : 'mdi:chevron-right'" />
          <span>Настроить кастомные лимиты</span>
          <span class="user-edit-form__limits-hint">
            ({{ formatTokens(form.tokenLimit) }} токенов, {{ form.bookLimit }} книг)
          </span>
        </button>

        <div v-if="showCustomLimits" class="user-edit-form__limits-fields">
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

      <KitFormGroup>
        <template #label>
          Новый пароль (оставьте пустым, чтобы не менять)
        </template>
        <KitInput v-model="form.password" type="password" placeholder="Новый пароль" />
      </KitFormGroup>

      <div class="user-edit-form__actions">
        <KitBtn variant="success" :disabled="saving" @click="handleSave">
          <Icon v-if="!saving" icon="mdi:content-save" />
          <span>{{ saving ? 'Сохранение...' : 'Сохранить' }}</span>
        </KitBtn>
        <KitBtn variant="danger" @click="handleDelete">
          <Icon icon="mdi:delete" />
          <span>Удалить</span>
        </KitBtn>
      </div>
      <div v-if="success" class="user-edit-form__success">
        {{ success }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-edit-form__back {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.user-edit-form__back-link {
  color: var(--fg-secondary-color, #8e867b);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.user-edit-form__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-edit-form__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}
.user-edit-form__card {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
}
.user-edit-form__readonly {
  font-size: 14px;
  color: var(--fg-secondary-color, #8e867b);
  padding: 4px 0;
}
.user-edit-form__limits-section {
  margin-bottom: 20px;
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 6px;
  background: var(--bg-primary-color, rgba(255, 255, 255, 0.4));
  overflow: hidden;
}
.user-edit-form__limits-toggle {
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
.user-edit-form__limits-toggle:hover {
  background: var(--bg-hover-color, rgba(0, 0, 0, 0.04));
}
.user-edit-form__limits-hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  font-weight: normal;
}
.user-edit-form__limits-fields {
  padding: 14px;
  border-top: 1px solid var(--border-secondary-color, #d9d1c7);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.user-edit-form__actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.user-edit-form__success {
  color: var(--fg-success-color, #4b8266);
  font-size: 14px;
  margin-top: 12px;
}
</style>
