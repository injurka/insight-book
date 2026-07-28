import { expect, loginAsAdmin, test } from '../fixtures'

test.describe('auth', () => {
  test('неавторизованный пользователь редиректится на /sign-in', async ({ page }) => {
    await page.goto('/dictionary')

    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test('логин admin/admin → редирект на главную с библиотекой', async ({ page }) => {
    await loginAsAdmin(page)

    await page.waitForURL(url => new URL(url).pathname === '/')
    await expect(page.locator('.library-view')).toBeVisible()
  })

  test('выход из аккаунта → снова /sign-in', async ({ page }) => {
    await loginAsAdmin(page)
    await page.waitForURL(url => new URL(url).pathname === '/')
    await expect(page.locator('.library-view')).toBeVisible()

    // Меню аккаунта в global-actions (иконка mdi:account-circle-outline)
    await page.locator('.global-actions button').last().click()
    await page.getByRole('button', { name: 'Выйти' }).click()

    await expect(page).toHaveURL(/\/sign-in$/)
    const token = await page.evaluate(() => localStorage.getItem('insight_token'))
    expect(token).toBeNull()
  })
})
