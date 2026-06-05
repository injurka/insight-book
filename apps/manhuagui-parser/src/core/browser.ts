import puppeteer, { Browser, Page } from 'puppeteer'

export async function launchBrowser(): Promise<{ browser: Browser, page: Page }> {
  const browser = await puppeteer.launch({
    headless: true, // Поставьте false для визуальной отладки
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security'
    ],
  })

  const page = await browser.newPage()

  // Внедряем скрытие признаков автоматизации (webdriver) до загрузки страницы
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
    // @ts-ignore
    window.chrome = { runtime: {} }

    const originalQuery = window.navigator.permissions.query
    // @ts-ignore
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission } as PermissionStatus) :
        originalQuery(parameters)
    )
  })

  // Оставляем только языковой заголовок. Использование Sec-Fetch-* здесь 
  // может заблокировать загрузку изображений (CDN прервет запрос)
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8'
  })

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36')
  await page.setViewport({ width: 1280, height: 800 })
  await page.setBypassCSP(true)

  // Перехват запросов для ускорения (убрано блокирование object/media, на случай если ридеру они нужны)
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const type = request.resourceType()
    if (
      ['font'].includes(type) ||
      request.url().includes('google-analytics') ||
      request.url().includes('doubleclick')
    ) {
      request.abort()
    } else {
      request.continue()
    }
  })

  return { browser, page }
}
