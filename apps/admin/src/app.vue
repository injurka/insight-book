<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '~/01.shared/store/auth.store'
import AdminLayout from '~/06.layouts/admin-layout.vue'

const auth = useAuthStore()

onMounted(() => {
  auth.checkAuth()
})
</script>

<template>
  <v-app>
    <AdminLayout v-if="auth.user">
      <RouterView />
    </AdminLayout>
    <RouterView v-else />
  </v-app>
</template>
