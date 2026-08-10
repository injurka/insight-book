<script setup lang="ts">
import UserEditForm from '~/05.modules/users/user-edit-form.vue'

interface Props {
  id: string
}

defineProps<Props>()
</script>

<template>
  <UserEditForm :id="id" />
</template>
