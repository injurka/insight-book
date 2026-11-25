<script setup lang="ts">
import UserDetailPage from '~/05.modules/users/user-detail-page.vue'

interface Props {
  id: string
}

defineProps<Props>()
</script>

<template>
  <UserDetailPage :id="id" />
</template>
