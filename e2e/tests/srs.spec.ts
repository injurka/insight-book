import { expect, loginAsAdmin, test } from '../fixtures'
import { seedDictionaryWords } from './srs.helpers'

/**
 * Путь «Тренировка SRS»:
 * /dictionary → дропдаун «Тренировка» → «Интервальное (SRS)» → «Начать»
 * → flip карточки → оценка «Хорошо» (FSRS Rating.Good)
 * → счётчик оставшихся карточек уменьшается → после всех карточек — SrsSummaryView.
 *
 * Замечание о счётчике «Осталось карточек»: в режиме SRS заголовок диалога
 * показывает не один счётчик, а два — `.stat-new` (оставшиеся новые) и
 * `.stat-review` (оставшиеся на повторении), title «Осталось карточек»
 * используется только в режимах cram/deep_dive/match. Все слова, добавленные
 * через API, — новые, поэтому проверяем уменьшение `.stat-new`.
 */

const RUN_ID = Date.now().toString(36)

function makeWords(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    word: `srs${prefix}${RUN_ID}w${i}`,
    translation: `перевод-${prefix}-${i}`,
  }))
}

async function openSrsTraining(page: import('@playwright/test').Page) {
  await loginAsAdmin(page)
  await page.waitForURL(url => new URL(url).pathname === '/')
  await page.goto('/dictionary')
  // Ждём загрузки словаря, иначе пункт меню disabled (store.words.length === 0)
  await expect(page.locator('.dict-header .badge')).toContainText('слов', { timeout: 15_000 })

  await page.getByRole('button', { name: /Тренировка/ }).click()
  await page.getByRole('button', { name: 'Интервальное (SRS)' }).click()

  const dialog = page.locator('.srs-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.dialog-title')).toContainText('Настройки (SRS)')
  return dialog
}

test.describe('srs-training', () => {
  test('полный путь: «Хорошо» по всем карточкам → счётчик уменьшается → экран итогов', async ({ page, request }) => {
    const words = makeWords('a', 3)
    await seedDictionaryWords(request, words)

    const dialog = await openSrsTraining(page)

    await dialog.getByRole('button', { name: 'Начать' }).click()

    const statNew = dialog.locator('.srs-stats .stat-new')
    const showAnswer = dialog.getByRole('button', { name: 'Показать ответ' })
    const goodBtn = dialog.locator('button.grade-btn.primary', { hasText: 'Хорошо' })

    // 3 новые карточки в очереди
    await expect(statNew).toHaveText('3')
    await expect(showAnswer).toBeVisible()

    // Карточка 1: flip → «Хорошо» → счётчик 3 → 2
    await showAnswer.click()
    await expect(goodBtn).toBeVisible()
    await goodBtn.click()
    await expect(statNew).toHaveText('2')

    // Карточки 2 и 3
    await showAnswer.click()
    await goodBtn.click()
    await expect(statNew).toHaveText('1')

    await showAnswer.click()
    await goodBtn.click()

    // Итоговый экран SrsSummaryView
    await expect(dialog.locator('.dialog-title')).toContainText('Итоги сессии')
    await expect(dialog.locator('.finished-state h2')).toContainText('Отличная работа!')
    await expect(dialog.getByText('Вы повторили все карточки')).toBeVisible()
    // Статистика: 3 новых изучено, точность 100%
    const statBoxes = dialog.locator('.finished-state .stat-box')
    await expect(statBoxes.nth(0).locator('.stat-val')).toHaveText('3')
    await expect(statBoxes.nth(2).locator('.stat-val')).toHaveText('100%')

    // Закрытие по кнопке «Завершить»
    await dialog.getByRole('button', { name: 'Завершить сессию' }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('одна карточка: «Хорошо» сразу завершает сессию', async ({ page, request }) => {
    const words = makeWords('b', 1)
    await seedDictionaryWords(request, words)

    const dialog = await openSrsTraining(page)

    await dialog.getByRole('button', { name: 'Начать' }).click()

    const statNew = dialog.locator('.srs-stats .stat-new')
    await expect(statNew).toHaveText('1')

    await dialog.getByRole('button', { name: 'Показать ответ' }).click()
    await dialog.locator('button.grade-btn.primary', { hasText: 'Хорошо' }).click()

    await expect(dialog.locator('.finished-state h2')).toContainText('Отличная работа!')
    await expect(dialog.locator('.finished-state .stat-box').first().locator('.stat-val')).toHaveText('1')
  })
})
