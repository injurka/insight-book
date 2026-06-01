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

let currentSequenceId = 0

const validChars = computed(() => {
  if (!props.text)
    return []
  return props.text.split('').filter(c => /[\u4E00-\u9FA5]/.test(c))
})

async function initWriters() {
  currentSequenceId++
  const seqId = currentSequenceId

  containerRefs.value.forEach((el) => {
    if (el)
      el.innerHTML = ''
  })
  writers.value = []

  if (validChars.value.length === 0) {
    emit('complete')
    return
  }

  // Получаем цвета из CSS переменных текущей темы
  const docStyle = getComputedStyle(document.documentElement)
  const strokeColor = docStyle.getPropertyValue('--fg-primary-color').trim() || '#2c3e50'
  const radicalColor = docStyle.getPropertyValue('--fg-accent-color').trim() || '#c975de'
  const outlineColor = docStyle.getPropertyValue('--border-secondary-color').trim() || '#e2e8f0'
  const hintColor = docStyle.getPropertyValue('--fg-muted-color').trim() || '#94a3b8'

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
  <div class="hanzi-board">
    <div
      v-for="(char, i) in validChars"
      :key="char"
      :ref="el => { if (el) containerRefs[i] = el as HTMLElement }"
      class="hanzi-char-container"
      :class="{ 'is-quiz': mode === 'quiz' }"
      :style="{ width: `${size}px`, height: `${size}px` }"
    />
  </div>
</template>

<style lang="scss" scoped>
.hanzi-board {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
}

.hanzi-char-container {
  background-color: var(--bg-tertiary-color);
  border-radius: 8px;
  border: 1px dashed var(--border-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-quiz {
    cursor: crosshair;
    touch-action: none;
    box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.05);
  }
}
</style>
