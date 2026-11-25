<script setup lang="ts">
import type { SubscriptionTier } from '~/01.shared/types/models'
import type { UserDetail } from '~/03.domain/user'
import { Icon } from '@iconify/vue'
import { computed, reactive, ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitInput from '~/02.kit/atoms/kit-input.vue'
import KitFormGroup from '~/02.kit/molecules/kit-form-group.vue'
import KitSelect from '~/02.kit/molecules/kit-select.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import KitPanel from '~/02.kit/organisms/kit-panel.vue'
import { formatTierOptions, formatTokens, getTierDefaults } from '~/03.domain/user'

interface Props {
  user: UserDetail
  tiers: SubscriptionTier[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  saved: []
  deleted: []
}>()

const { admin } = useRepos()

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

const tierOptions = computed(() => formatTierOptions(props.tiers))

function onTierSelect(newTier: string) {
  form.subscriptionTier = newTier
  const defaults = getTierDefaults(newTier, props.tiers)
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
  form.password = ''
}

function addIfChanged(patch: Record<string, unknown>, key: string, newVal: unknown, oldVal: unknown) {
  if (newVal !== oldVal)
    patch[key] = newVal
}

function buildPatch(): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const u = props.user

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

const hasChanges = computed(() => Object.keys(buildPatch()).length > 0)

async function handleSave() {
  const patch = buildPatch()

  if (Object.keys(patch).length === 0)
    return

  saving.value = true
  error.value = ''
  success.value = ''

  try {
    await admin.updateUser(props.user.id, patch)
    success.value = 'Сохранено'
    emit('saved')
    setTimeout(() => {
      success.value = ''
    }, 2500)
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!confirm(`Удалить пользователя "${props.user.username}"? Это действие необратимо.`))
    return

  try {
    await admin.deleteUser(props.user.id)
    emit('deleted')
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}

watch(() => props.user, populateForm, { immediate: true })
</script>

<template>
  <KitPanel title="Настройки аккаунта" icon="mdi:account-cog-outline">
    <form class="form" @submit.prevent="handleSave">
      <KitFormGroup>
        <template #label>
          Имя пользователя
        </template>
        <KitInput v-model="form.username" autocomplete="username" />
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

      <div class="form__row">
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
      </div>

      <div class="limits">
        <button
          type="button"
          class="limits__toggle"
          :aria-expanded="showCustomLimits"
          @click="showCustomLimits = !showCustomLimits"
        >
          <Icon :icon="showCustomLimits ? 'mdi:chevron-down' : 'mdi:chevron-right'" />
          <span>Кастомные лимиты</span>
          <span class="limits__hint">
            {{ formatTokens(form.tokenLimit) }} токенов · {{ form.bookLimit }} книг
          </span>
        </button>

        <div v-if="showCustomLimits" class="limits__fields">
          <KitFormGroup>
            <template #label>
              Лимит токенов
            </template>
            <KitInput v-model.number="form.tokenLimit" type="number" />
          </KitFormGroup>
          <KitFormGroup>
            <template #label>
              Лимит книг
            </template>
            <KitInput v-model.number="form.bookLimit" type="number" />
          </KitFormGroup>
        </div>
      </div>

      <KitFormGroup>
        <template #label>
          Новый пароль
        </template>
        <KitInput
          v-model="form.password"
          type="password"
          placeholder="Оставьте пустым, чтобы не менять"
          autocomplete="new-password"
        />
      </KitFormGroup>

      <KitError v-if="error" :message="error" />

      <div class="form__footer">
        <KitBtn type="button" variant="ghost-danger" @click="handleDelete">
          <Icon icon="mdi:delete-outline" />
          <span>Удалить</span>
        </KitBtn>

        <div class="form__submit">
          <span v-if="success" class="form__success">
            <Icon icon="mdi:check" />
            {{ success }}
          </span>
          <KitBtn type="submit" variant="success" :disabled="saving || !hasChanges">
            <Icon v-if="!saving" icon="mdi:content-save" />
            <span>{{ saving ? 'Сохранение...' : 'Сохранить' }}</span>
          </KitBtn>
        </div>
      </div>
    </form>
  </KitPanel>
</template>

<style scoped>
.form__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.limits {
  margin-bottom: 16px;
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  background: var(--bg-primary-color, #f3efe9);
  overflow: hidden;
}

.limits__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--fg-primary-color, #4a443c);
  text-align: left;
}

.limits__toggle:hover {
  background: var(--bg-hover-color, rgba(0, 0, 0, 0.04));
}

.limits__hint {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: var(--fg-secondary-color, #8e867b);
}

.limits__fields {
  padding: 14px 12px 0;
  border-top: 1px solid var(--border-secondary-color, #d9d1c7);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.form__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 14px;
  margin-top: 4px;
  border-top: 1px solid var(--border-secondary-color, #d9d1c7);
}

.form__submit {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form__success {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-success-color, #4b8266);
}
</style>
