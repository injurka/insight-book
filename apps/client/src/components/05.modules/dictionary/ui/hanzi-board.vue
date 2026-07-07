<script setup lang="ts">
import HanziWriter from 'hanzi-writer'

const props = withDefaults(defineProps<{
  text: string
  mode: 'animation' | 'quiz'
  size?: number
}>(), {
  size: 100,
})

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const containerRefs = ref<HTMLElement[]>([])
const writers = shallowRef<HanziWriter[]>([])

const currentIndex = ref(0)
let currentSequenceId = 0

const trackTransform = computed(() => {
  const smallSize = props.size * 0.25
  const gap = 16
  const activeCenter = currentIndex.value * (smallSize + gap) + (props.size / 2)
  return {
    transform: `translateX(-${activeCenter}px)`,
  }
})

const validChars = computed(() => {
  if (!props.text)
    return []
  return props.text.split('').filter(c => /[\u4E00-\u9FA5]/.test(c))
})

async function initWriters() {
  currentSequenceId++
  const seqId = currentSequenceId
  currentIndex.value = 0

  containerRefs.value.forEach((el) => {
    if (el)
      el.innerHTML = ''
  })
  writers.value = []

  if (validChars.value.length === 0) {
    emit('complete')
    return
  }

  const docStyle = getComputedStyle(document.documentElement)
  const strokeColor = docStyle.getPropertyValue('--fg-primary-color').trim() || '#2c3e50'
  const radicalColor = docStyle.getPropertyValue('--fg-accent-color').trim() || '#c975de'
  const outlineColor = docStyle.getPropertyValue('--border-secondary-color').trim() || '#e2e8f0'
  const hintColor = docStyle.getPropertyValue('--fg-tertiary-color').trim() || '#94a3b8'

  const newWriters: HanziWriter[] = []

  for (let i = 0; i < validChars.value.length; i++) {
    const el = containerRefs.value[i]
    if (!el)
      continue

    const writer = HanziWriter.create(el, validChars.value[i], {
      width: props.size,
      height: props.size,
      padding: 5,
      showOutline: true,
      showCharacter: false,
      strokeAnimationSpeed: 1.5,
      delayBetweenStrokes: 50,
      strokeColor,
      radicalColor,
      outlineColor,
      highlightColor: hintColor,
      drawingWidth: 20,
    })
    newWriters.push(writer)
  }

  writers.value = newWriters

  if (props.mode === 'quiz') {
    startQuizSequence(0, seqId)
  }
  else if (props.mode === 'animation') {
    startAnimationSequence(0, seqId)
  }
}

function startQuizSequence(index: number, seqId: number) {
  if (seqId !== currentSequenceId)
    return
  if (index >= writers.value.length) {
    emit('complete')
    return
  }
  currentIndex.value = index
  writers.value[index].quiz({
    onComplete: () => {
      if (seqId !== currentSequenceId)
        return
      setTimeout(startQuizSequence, 300, index + 1, seqId)
    },
  })
}

function startAnimationSequence(index: number, seqId: number) {
  if (seqId !== currentSequenceId)
    return
  if (index >= writers.value.length)
    return
  currentIndex.value = index
  writers.value[index].animateCharacter({
    onComplete: () => {
      if (seqId !== currentSequenceId)
        return
      setTimeout(startAnimationSequence, 300, index + 1, seqId)
    },
  })
}

function replay() {
  currentSequenceId++
  const seqId = currentSequenceId

  writers.value.forEach((w) => {
    w.cancelQuiz()
    w.hideCharacter()
  })

  if (props.mode === 'animation') {
    startAnimationSequence(0, seqId)
  }
  else if (props.mode === 'quiz') {
    startQuizSequence(0, seqId)
  }
}

defineExpose({ replay })

watch(() => props.text, async () => {
  await nextTick()
  initWriters()
})

onMounted(initWriters)
</script>

<template>
  <div class="hanzi-board" :class="{ 'has-multiple': validChars.length > 1 }" :style="{ height: `${size + 16}px` }">
    <div class="board-track" :style="trackTransform">
      <div
        v-for="(char, i) in validChars"
        :key="char"
        :ref="el => { if (el) containerRefs[i] = el as HTMLElement }"
        class="hanzi-char-container"
        :class="{
          'is-quiz': mode === 'quiz' && i === currentIndex,
          'is-active': i === currentIndex,
          'is-past': i < currentIndex,
          'is-future': i > currentIndex,
        }"
        :style="{
          width: i === currentIndex ? `${size}px` : `${size * 0.25}px`,
          height: i === currentIndex ? `${size}px` : `${size * 0.25}px`,
        }"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hanzi-board {
  position: relative;
  display: flex;
  align-items: center;
  margin: 16px 0;
  width: 100%;
  overflow: hidden;
}

.board-track {
  position: absolute;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.hanzi-char-container {
  background-color: var(--bg-tertiary-color);
  border-radius: 12px;
  border: 2px dashed var(--border-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.5;

  &.is-active {
    opacity: 1;
    border-color: var(--fg-accent-color);
  }

  &.is-past {
    opacity: 0.8;
    border-style: solid;
    border-color: var(--border-secondary-color);
    background-color: var(--bg-secondary-color);
  }

  &.is-quiz {
    cursor: crosshair;
    touch-action: none;
  }

  :deep(svg) {
    width: 100% !important;
    height: 100% !important;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
}
</style>
