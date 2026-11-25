<script setup lang="ts">
import UserActivityPanel from '~/05.modules/users/user-activity-panel.vue'
import UserEditForm from '~/05.modules/users/user-edit-form.vue'

interface Props {
  id: string
}

defineProps<Props>()
</script>

<template>
  <div class="user-edit-view">
    <UserEditForm :id="id" />
    <div class="user-edit-view__analytics">
      <UserActivityPanel :id="id" />
    </div>
  </div>
</template>

<style scoped>
.user-edit-view {
  display: grid;
  grid-template-columns: minmax(340px, 460px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.user-edit-view__analytics {
  padding-top: 52px;
}

@media (max-width: 1120px) {
  .user-edit-view {
    grid-template-columns: 1fr;
  }

  .user-edit-view__analytics {
    padding-top: 0;
  }
}
</style>
