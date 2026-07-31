<script setup lang="ts">
import { useMouse } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'

const props = withDefaults(defineProps<Props>(), {
  radius: 200,
  opacity: 0.10,
  text: [
    // О чтении, книгах и языках
    'A reader lives a thousand lives before he dies.',
    'The man who never reads lives only one.',
    'Чтение — это один из истоков мышления и умственного развития.',
    '千里之行，始于足下。',
    '読書は心の糧。',
    'There is no friend as loyal as a book.',
    'Учиться и, когда придет время, прикладывать усвоенное к делу — разве это не прекрасно?',
    'To learn another language is to have one more window from which to look at the world.',
    'Всякая книга — умный друг.',
    'I cannot live without books.',
    'A room without books is like a body without a soul.',
    'The more that you read, the more things you will know.',
    'El que lee mucho y anda mucho, ve mucho y sabe mucho.',
    'Words are, in my not-so-humble opinion, our most inexhaustible source of magic.',

    // Английская классика
    'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
    'All we have to decide is what to do with the time that is given us.',
    'To be, or not to be, that is the question.',
    'Call me Ishmael.',
    'Fairy tales are more than true: not because they tell us that dragons exist, but because they tell us that dragons can be beaten.',
    'So it goes.',
    'It was the best of times, it was the worst of times.',

    // Русская классика
    'Все счастливые семьи похожи друг на друга, каждая несчастливая семья несчастлива по-своему.',
    'Рукописи не горят.',
    'Тварь ли я дрожащая или право имею?',
    'Красота спасет мир.',
    'Служить бы рад, прислуживаться тошно.',
    'Зорко одно лишь сердце. Самого главного глазами не увидишь.',

    // Китайская литература и философия
    '学而不思则罔，思而不学则殆。', // Конфуций
    '天下大势，分久必合，合久必分。', // Троецарствие
    '路漫漫其修远兮，吾将上下而求索。', // Цюй Юань
    '不积跬步，无以至千里。', // Сюнь-цзы

    // Японская литература
    '国境の長いトンネルを抜けると雪国であった。', // Ясунари Кавабата (Снежная страна)
    '恥の多い生涯を送って来ました。', // Осаму Дадзай (Исповедь неполноценного человека)
    '春はあけぼの。', // Сэй Сёнагон (Записки у изголовья)
    '吾輩は猫である。名前はまだ無い。', // Нацумэ Сосэки (Ваш покорный слуга кот)
    '祇園精舎の鐘の声、諸行無常の響きあり。', // Повесть о доме Тайра

    // Европейская классика (Испанский, Французский, Немецкий, Итальянский)
    'En un lugar de la Mancha, de cuyo nombre no quiero acordarme...', // Сервантес (Дон Кихот)
    'Muchos años después, frente al pelotón de fusilamiento, el coronel Aureliano Buendía había de recordar aquella tarde remota...', // Маркес (Сто лет одиночества)
    'On ne voit bien qu\'avec le cœur. L\'essentiel est invisible pour les yeux.', // Сент-Экзюпери (Маленький принц)
    'Il faut cultiver notre jardin.', // Вольтер (Кандид)
    'Zwei Seelen wohnen, ach! in meiner Brust.', // Гете (Фауст)
    'Nel mezzo del cammin di nostra vita mi ritrovai per una selva oscura...', // Данте (Божественная комедия)
  ].join(' ✨ '),
})

const settingsStore = useGlobalSettingsStore()

interface Props {
  text?: string
  radius?: number
  opacity?: number
}

// 1. Создаем ссылку на корневой элемент
const bgRef = ref<HTMLElement | null>(null)

const { x: mouseX, y: mouseY } = useMouse({ type: 'client' })

// 2. Обновляем CSS-переменные напрямую, МИНУЯ цикл рендера Vue
watch([mouseX, mouseY], ([x, y]) => {
  if (bgRef.value) {
    bgRef.value.style.setProperty('--mouse-x', `${x}px`)
    bgRef.value.style.setProperty('--mouse-y', `${y}px`)
  }
})

// 3. Статичные стили оставляем в computed (они меняются редко)
const staticBgStyle = computed(() => ({
  '--reveal-radius': `${props.radius}px`,
  '--reveal-opacity': props.opacity,
}))

const repeatedText = computed(() => Array.from({ length: 50 }).fill(props.text).join(' ✨ '))
</script>

<template>
  <!-- 4. Вешаем ref и привязываем только статичные стили -->
  <div
    v-if="settingsStore.enableHoverRevealBg"
    ref="bgRef"
    class="hover-reveal-bg"
    :style="staticBgStyle"
  >
    <div class="reveal-content">
      <slot>{{ repeatedText }}</slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hover-reveal-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  user-select: none;
  overflow: hidden;

  .reveal-content {
    width: 100vw;
    height: 100vh;
    color: var(--fg-accent-color);
    font-family: 'Maple Mono CN', 'Microsoft YaHei', sans-serif;
    font-size: 1.1rem;
    line-height: 1.6;
    font-weight: 600;
    text-align: justify;
    word-break: break-all;
    opacity: var(--reveal-opacity);
    padding: 24px;
    box-sizing: border-box;

    mask-image: radial-gradient(
      circle var(--reveal-radius) at var(--mouse-x, -500px) var(--mouse-y, -500px),
      black 0%,
      rgba(0, 0, 0, 0.5) 40%,
      transparent 100%
    );
    -webkit-mask-image: radial-gradient(
      circle var(--reveal-radius) at var(--mouse-x, -500px) var(--mouse-y, -500px),
      black 0%,
      rgba(0, 0, 0, 0.5) 40%,
      transparent 100%
    );
  }
}
</style>
