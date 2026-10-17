<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section
    class="deck-loader"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="loader-art" aria-hidden="true">
      <div class="art-halo" />
      <div class="orbit orbit-outer" /><div class="orbit orbit-inner" />
      <div class="floating-card card-back">
        <Icon icon="mdi:format-letter-case" /><span /><span />
      </div>
      <div class="floating-card card-front">
        <Icon icon="mdi:translate" /><span /><span /><i><Icon icon="mdi:check" /></i>
      </div>
      <div class="book-tile">
        <Icon icon="mdi:book-open-page-variant-outline" /><div class="scan-light" />
      </div>
      <span class="spark spark-one" /><span class="spark spark-two" /><span class="spark spark-three" />
    </div>
    <div class="loader-copy">
      <h2>{{ t('bookDeck.loadingTitle') }}</h2>
      <p>{{ t('bookDeck.scanning') }}</p>
    </div>
    <div class="activity-track" aria-hidden="true">
      <span />
    </div>
    <div class="loader-caption">
      <Icon icon="mdi:bookmark-multiple-outline" /><span>{{ t('bookDeck.loadingHint') }}</span>
    </div>
  </section>
</template>

<style scoped lang="scss">
.deck-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: clamp(28px, 7vh, 76px) 16px 48px;
  text-align: center;
}
.loader-art {
  position: relative;
  width: 280px;
  height: 210px;
  flex: 0 0 auto;
}
.art-halo {
  position: absolute;
  inset: -24px -18px;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--fg-accent-color) 12%, transparent), transparent 68%);
}
.orbit {
  position: absolute;
  border: 1px solid color-mix(in srgb, var(--fg-accent-color) 12%, transparent);
  border-radius: 50%;
}
.orbit-outer {
  inset: 4px 13px;
  transform: rotate(-20deg);
}
.orbit-inner {
  inset: 30px 44px;
  border-style: dashed;
  opacity: 0.65;
  transform: rotate(20deg);
}
.book-tile {
  position: absolute;
  left: 77px;
  top: 69px;
  display: grid;
  place-items: center;
  width: 114px;
  height: 102px;
  border: 1px solid color-mix(in srgb, var(--fg-accent-color) 25%, var(--border-secondary-color));
  border-radius: 25px;
  background: var(--bg-primary-color);
  color: var(--fg-accent-color);
  box-shadow: 0 12px 30px color-mix(in srgb, var(--fg-accent-color) 10%, transparent);
  overflow: hidden;
  transform: rotate(-7deg);
  animation: book-breathe 4s ease-in-out infinite;
}
.book-tile > :first-child {
  width: 59px;
  height: 59px;
}
.scan-light {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    110deg,
    transparent 30%,
    color-mix(in srgb, var(--fg-accent-color) 12%, transparent) 50%,
    transparent 70%
  );
  transform: translateX(-110%);
  animation: scan-pages 3.4s ease-in-out infinite;
}
.floating-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 68px;
  height: 85px;
  padding: 12px;
  box-sizing: border-box;
  gap: 6px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  background: var(--bg-primary-color);
  box-shadow: 0 5px 15px rgb(0 0 0 / 0.035);
}
.floating-card > :first-child {
  width: 23px;
  height: 23px;
  margin-bottom: 4px;
  color: var(--fg-accent-color);
}
.floating-card > span {
  width: 100%;
  height: 3px;
  border-radius: 4px;
  background: var(--border-secondary-color);
}
.floating-card > span:last-of-type {
  width: 65%;
}
.card-back {
  left: 43px;
  top: 31px;
  transform: rotate(-16deg);
  animation: card-drift-back 4s ease-in-out infinite;
}
.card-front {
  right: 32px;
  top: 24px;
  transform: rotate(12deg);
  animation: card-drift-front 4s ease-in-out infinite;
}
.card-front i {
  position: absolute;
  right: -7px;
  bottom: -7px;
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  border: 3px solid var(--bg-primary-color);
  border-radius: 50%;
  background: var(--fg-accent-color);
  color: var(--bg-primary-color);
  font-size: 13px;
}
.spark {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--fg-accent-color);
  opacity: 0.4;
  animation: spark-pulse 3s ease-in-out infinite;
}
.spark-one {
  left: 29px;
  top: 124px;
}
.spark-two {
  right: 23px;
  top: 135px;
  animation-delay: 1s;
}
.spark-three {
  left: 144px;
  top: 11px;
  width: 4px;
  height: 4px;
  animation-delay: 2s;
}
.loader-copy {
  max-width: 420px;
}
.loader-copy h2 {
  margin: 8px 0 10px;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--fg-primary-color);
}
.loader-copy p {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  line-height: 1.75;
  text-wrap: balance;
}
.activity-track {
  width: 144px;
  height: 3px;
  overflow: hidden;
  margin: 24px 0 18px;
  border-radius: 10px;
  background: var(--border-secondary-color);
}
.activity-track span {
  display: block;
  height: 100%;
  width: 50%;
  border-radius: inherit;
  background: var(--fg-accent-color);
  animation: activity-sweep 2s ease-in-out infinite;
}
.loader-caption {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 7px;
  max-width: 340px;
  color: var(--fg-secondary-color);
  font-size: 0.72rem;
  line-height: 1.6;
}
.loader-caption > :first-child {
  flex: 0 0 15px;
  margin-top: 2px;
  opacity: 0.7;
}
@keyframes book-breathe {
  50% {
    transform: translateY(-4px) rotate(-4deg);
  }
}
@keyframes card-drift-back {
  50% {
    transform: translate(-5px, -7px) rotate(-20deg);
  }
}
@keyframes card-drift-front {
  50% {
    transform: translate(4px, -8px) rotate(16deg);
  }
}
@keyframes scan-pages {
  60%,
  100% {
    transform: translateX(110%);
  }
}
@keyframes spark-pulse {
  50% {
    opacity: 0.15;
    transform: scale(0.7);
  }
}
@keyframes activity-sweep {
  from {
    transform: translateX(-110%);
  }
  to {
    transform: translateX(310%);
  }
}
@media (max-width: 480px) {
  .deck-loader {
    padding-top: 24px;
  }
  .loader-copy h2 {
    font-size: 1.1rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .loader-art *,
  .activity-track span {
    animation: none;
  }
  .scan-light {
    display: none;
  }
  .activity-track span {
    margin-inline: auto;
    opacity: 0.6;
  }
}
</style>
