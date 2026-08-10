<script setup lang="ts">
import type { UserRow } from '~/03.domain/user'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBadge from '~/02.kit/atoms/kit-badge.vue'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitInput from '~/02.kit/atoms/kit-input.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitPagination from '~/02.kit/molecules/kit-pagination.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import { formatLimit, formatTokens } from '~/03.domain/user'

const { admin } = useRepos()

const users = ref<UserRow[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const search = ref('')
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await admin.listUsers({ page: page.value, limit, search: search.value || undefined })
    users.value = res.data
    total.value = res.total
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally { loading.value = false }
}

async function handleDelete(user: UserRow) {
  if (!confirm(`Удалить пользователя "${user.username}"? Это действие необратимо.`))
    return
  try {
    await admin.deleteUser(user.id)
    await load()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

let searchTimer: ReturnType<typeof setTimeout>

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU')
}

function onPageChange(p: number) {
  page.value = p
  load()
}

onMounted(() => load())
</script>

<template>
  <div>
    <div class="users-list__header">
      <h1 class="users-list__title">
        <Icon icon="mdi:account-group" class="users-list__title-icon" />
        <span>Пользователи</span>
      </h1>
      <RouterLink to="/users/create" class="users-list__create-link">
        <KitBtn variant="primary">
          <Icon icon="mdi:plus" />
          <span>Создать</span>
        </KitBtn>
      </RouterLink>
    </div>

    <div style="margin-bottom:16px">
      <KitInput
        v-model="search"
        placeholder="Поиск по имени или email..."
        style="max-width:400px"
      />
    </div>

    <KitError v-if="error" :message="error" />

    <table v-if="loading || users.length" class="users-list__table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Имя</th>
          <th>Email</th>
          <th>Роль</th>
          <th>Подписка</th>
          <th>Лимиты</th>
          <th>Создан</th>
          <th style="width: 100px; text-align: right;">
            Действия
          </th>
        </tr>
      </thead>
      <tbody v-if="loading">
        <tr v-for="i in 6" :key="i" class="users-list__skeleton-row">
          <td>
            <KitSkeleton width="30px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="110px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="150px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="55px" height="20px" border-radius="10px" />
          </td>
          <td>
            <KitSkeleton width="45px" height="20px" border-radius="10px" />
          </td>
          <td>
            <KitSkeleton width="180px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="75px" height="16px" />
          </td>
          <td>
            <div class="users-list__actions">
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
            </div>
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.id }}</td>
          <td>
            <RouterLink :to="`/users/${user.id}`" class="users-list__name-link">
              {{ user.username }}
            </RouterLink>
          </td>
          <td class="users-list__muted">
            {{ user.email || '—' }}
          </td>
          <td>
            <KitBadge :variant="user.role === 'admin' ? 'admin' : 'user'">
              {{ user.role }}
            </KitBadge>
          </td>
          <td>
            <KitBadge :variant="user.subscriptionTier === 'free' ? 'free' : 'pro'">
              {{ user.subscriptionTier }}
            </KitBadge>
          </td>
          <td class="users-list__muted users-list__small">
            {{ formatTokens(user.usedTokens) }}/{{ formatTokens(user.tokenLimit) }} токенов, {{ formatLimit(user.bookLimit) }} книг
          </td>
          <td class="users-list__muted users-list__small">
            {{ formatDate(user.createdAt) }}
          </td>
          <td>
            <div class="users-list__actions">
              <RouterLink :to="`/users/${user.id}`" class="users-list__action-link">
                <KitBtn
                  variant="ghost"
                  style="padding: 4px 6px; font-size: 12px"
                  title="Редактировать"
                >
                  <Icon icon="mdi:pencil" />
                </KitBtn>
              </RouterLink>
              <KitBtn
                variant="ghost-danger"
                style="padding: 4px 6px; font-size: 12px"
                title="Удалить"
                @click="handleDelete(user)"
              >
                <Icon icon="mdi:delete" />
              </KitBtn>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="!loading && !users.length && !error" class="users-list__empty">
      Пользователи не найдены
    </div>
    <KitPagination :page="page" :total-pages="totalPages" @update:page="onPageChange" />
  </div>
</template>

<style scoped>
.users-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.users-list__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  display: flex;
  align-items: center;
  gap: 10px;
}
.users-list__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}
.users-list__create-link {
  text-decoration: none;
}
.users-list__table {
  width: 100%;
  border-collapse: collapse;
}
.users-list__table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-primary-color, #c7c0b6);
}
.users-list__table td {
  padding: 10px 12px;
  font-size: 14px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
  vertical-align: middle;
}
.users-list__table tr:hover td {
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.1));
}
.users-list__name-link {
  color: var(--fg-accent-color, #4b8266);
  text-decoration: none;
  font-weight: 500;
}
.users-list__muted {
  color: var(--fg-secondary-color, #8e867b);
}
.users-list__small {
  font-size: 13px;
}
.users-list__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.users-list__action-link {
  text-decoration: none;
  display: inline-flex;
}
.users-list__empty {
  color: var(--fg-secondary-color, #8e867b);
  text-align: center;
  padding: 40px;
}
.users-list__skeleton {
  padding: 0;
}
</style>
