/* eslint-disable no-console */
import { getIcons } from '@iconify/utils'

const SOURCE_DIR = `${import.meta.dir}/../src`
const OUTPUT_FILE = `${import.meta.dir}/../src/assets/icons-bundle.json`

const ICON_REGEX = /\bmdi:[\w-]+/g

async function scanFiles(dir: string): Promise<string[]> {
  const icons = new Set<string>()
  // Нативный Bun Glob для быстрой фильтрации файлов
  const glob = new Bun.Glob('**/*.{vue,ts,js,json}')

  for await (const file of glob.scan({ cwd: dir, absolute: true })) {
    const content = await Bun.file(file).text()
    const matches = content.match(ICON_REGEX)
    if (matches)
      matches.forEach(match => icons.add(match.replace('mdi:', '')))
  }

  return Array.from(icons)
}

async function bundle() {
  console.log('🔍 Сканирование иконок...')
  const usedIcons = await scanFiles(SOURCE_DIR)

  if (usedIcons.length === 0) {
    console.warn('⚠️ Иконки не найдены. Проверьте путь сканирования или префикс.')
    await Bun.write(OUTPUT_FILE, JSON.stringify({ prefix: 'mdi', icons: {} }))

    return
  }

  console.log(`✨ Найдено ${usedIcons.length} уникальных иконок.`)

  try {
    // Нативное разрешение пути в Bun без использования Node.js модулей
    const mdiJsonUrl = import.meta.resolve('@iconify-json/mdi/icons.json')
    const mdiJsonPath = mdiJsonUrl.startsWith('file://') ? mdiJsonUrl.slice(7) : mdiJsonUrl

    // Bun.file() автоматически может распарсить JSON через .json()
    const fullCollection = await Bun.file(mdiJsonPath).json()
    const filteredCollection = getIcons(fullCollection, usedIcons)

    if (!filteredCollection)
      throw new Error('Не удалось создать подборку иконок.')

    await Bun.write(OUTPUT_FILE, JSON.stringify(filteredCollection))
    console.log(`✅ Бандл иконок успешно создан: ${OUTPUT_FILE}`)
  }
  catch (error) {
    console.error('❌ Ошибка при сборке иконок:')
    if (error instanceof Error && error.message.includes('Cannot find package'))
      console.error('   Пакет @iconify-json/mdi не найден. Установите его: bun add -D @iconify-json/mdi')

    else
      console.error(error)

    process.exit(1)
  }
}

bundle().catch((err) => {
  console.error(err)
  process.exit(1)
})
