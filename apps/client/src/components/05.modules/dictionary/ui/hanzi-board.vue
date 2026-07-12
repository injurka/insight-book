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
const isComplete = ref(false)
let currentSequenceId = 0

const validChars = computed(() => {
  if (!props.text)
    return []

  return props.text.split('').filter(c => /[\u4E00-\u9FA5]/.test(c))
})

const trackTransform = computed(() => {
  const gap = 16
  let activeCenter = 0

  if (isComplete.value) {
    const totalWidth = validChars.value.length * props.size + (validChars.value.length - 1) * gap
    activeCenter = totalWidth / 2
  }
  else {
    const smallSize = props.size * 0.25
    activeCenter = currentIndex.value * (smallSize + gap) + (props.size / 2)
  }

  return {
    transform: `translateX(-${activeCenter}px)`,
  }
})

async function initWriters() {
  currentSequenceId++
  const seqId = currentSequenceId
  currentIndex.value = 0
  isComplete.value = false

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
      showOutline: props.mode !== 'quiz',
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
    isComplete.value = true
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
  if (index >= writers.value.length) {
    isComplete.value = true
    emit('complete')
    return
  }
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
  isComplete.value = false

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
  <div
    class="hanzi-board"
    :class="{ 'has-multiple': validChars.length > 1, 'is-completed-board': isComplete }"
    :style="{
      'height': `${size + 16}px`,
      '--char-count': validChars.length,
      '--gap-total': `${(validChars.length - 1) * 16}px`,
    }"
  >
    <div class="board-track" :style="trackTransform">
      <div
        v-for="(char, i) in validChars"
        :key="char"
        :ref="el => { if (el) containerRefs[i] = el as HTMLElement }"
        class="hanzi-char-container"
        :class="{
          'is-quiz': mode === 'quiz' && i === currentIndex && !isComplete,
          'is-active': i === currentIndex && !isComplete,
          'is-past': i < currentIndex && !isComplete,
          'is-future': i > currentIndex && !isComplete,
          'is-complete': isComplete,
        }"
        :style="{
          width: isComplete ? `${size}px` : (i === currentIndex ? `${size}px` : `${size * 0.25}px`),
          height: isComplete ? `${size}px` : (i === currentIndex ? `${size}px` : `${size * 0.25}px`),
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

  &.is-completed-board {
    overflow-x: auto;
    justify-content: center;
    padding: 0 8px;

    .board-track {
      position: static;
      transform: none !important;
      margin: 0 auto;
      display: flex;
      justify-content: center;
      gap: 16px;
      width: 100%;
      max-width: 100%;
    }
  }
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

  &.is-complete {
    opacity: 1;
    border-color: transparent;
    background-color: transparent;
    max-width: calc((100% - var(--gap-total, 0px)) / var(--char-count, 1));
    height: auto !important;
    aspect-ratio: 1 / 1;
  }

  :deep(svg) {
    width: 100% !important;
    height: 100% !important;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
}
</style>
