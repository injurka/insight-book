import { runInNewContext } from 'node:vm'
import { describe, expect, test } from 'bun:test'

const html = await Bun.file(new URL('../src/index.html', import.meta.url)).text()
const callbackScript = html.match(/<script>\s*(;\(\(\) => \{\s*if \(window\.location\.pathname[\s\S]*?)<\/script>/)?.[1]

if (!callbackScript)
  throw new Error('Missing early OAuth callback script')

function redirectFrom(url: string, apiUrl?: string) {
  let redirectedTo: string | undefined
  const location = new URL(url)
  runInNewContext(callbackScript!, {
    URL,
    window: {
      __APP_CONFIG__: apiUrl ? { API_URL: apiUrl } : undefined,
      location: {
        pathname: location.pathname,
        search: location.search,
        hostname: location.hostname,
        origin: location.origin,
        replace: (target: string) => { redirectedTo = target },
      },
    },
  })

  return redirectedTo
}

describe('OAuth callback before SPA bootstrap', () => {
  test('preserves the code and state when forwarding to the production API', () => {
    expect(redirectFrom('https://insight-book.ru/api/auth/yandex/callback?code=test&state=a%2Bb&cid=test'))
      .toBe('https://insight-book-api.limited-dissolve.ru/api/auth/yandex/callback?code=test&state=a%2Bb&cid=test')
  })

  test('uses runtime API configuration', () => {
    expect(redirectFrom('https://insight-book.ru/api/auth/yandex/callback?code=test', 'https://api.example.com'))
      .toBe('https://api.example.com/api/auth/yandex/callback?code=test')
  })

  test('does not loop on a same-origin API or local dev proxy', () => {
    expect(redirectFrom('https://insight-book.ru/api/auth/yandex/callback', 'https://insight-book.ru')).toBeUndefined()
    expect(redirectFrom('http://localhost:5173/api/auth/yandex/callback')).toBeUndefined()
  })

  test('leaves the token callback and other pages to the router', () => {
    expect(redirectFrom('https://insight-book.ru/auth/yandex/callback?token=test')).toBeUndefined()
    expect(redirectFrom('https://insight-book.ru/')).toBeUndefined()
  })

  test('loads configuration and fonts relative to the build base', () => {
    expect(html).toContain('src="%BASE_URL%configs/app-config.js"')
    expect(html).not.toContain('href="./fonts/')
  })
})
