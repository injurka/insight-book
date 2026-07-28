import type { Page } from '@playwright/test'
import { test as base } from '@playwright/test'

export const ADMIN_CREDENTIALS = { login: 'admin', password: 'admin' }

/**
 * Базовый test с подготовленным контекстом:
 * - пропускает онбординг (router guard редиректит на /onboarding без этого флага).
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      localStorage.setItem('insight_onboarding_completed', 'true')
    })
    await use(context)
  },
})

export { expect } from '@playwright/test'

/**
 * Логин через UI формой «Логин или email / Пароль».
 * Форма скрыта: показывается по long-press (1s) или тройному клику на бейдже.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/sign-in')

  const badge = page.locator('.auth-badge')
  const box = await badge.boundingBox()
  if (!box)
    throw new Error('Auth badge not found on /sign-in')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(1100)
  await page.mouse.up()

  await page.getByPlaceholder('Логин или email').fill(ADMIN_CREDENTIALS.login)
  await page.getByPlaceholder('Пароль').fill(ADMIN_CREDENTIALS.password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
}
