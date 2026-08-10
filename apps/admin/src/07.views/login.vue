<script setup lang="ts">
import LoginForm from '~/04.features/auth/login-form.vue'
</script>

<template>
  <div class="login-page">
    <LoginForm />
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-primary-color, #f3efe9);
}
</style>
