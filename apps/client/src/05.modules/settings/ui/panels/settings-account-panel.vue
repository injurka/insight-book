<script setup lang="ts">
import LinkedAccountsCard from './account/linked-accounts-card.vue'
import UserProfileCard from './account/user-profile-card.vue'
</script>

<template>
  <div class="settings-account-panel">
    <UserProfileCard />
    <LinkedAccountsCard />
  </div>
</template>

<style lang="scss" scoped>
.settings-account-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
