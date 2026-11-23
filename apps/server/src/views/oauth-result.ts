import { CACHE_PROFILES } from '../utils/cache'

const copy = {
  ru: {
    success: 'Вход подтверждён',
    linked: 'Яндекс ID привязан',
    cancelled: 'Вход отменён',
    expired: 'Срок входа истёк',
    failed: 'Не удалось продолжить',
    confirmed: 'Вернитесь в InsightBook, чтобы продолжить.',
    retry: 'Если вы хотите повторить попытку, начните её заново в InsightBook.',
    open: 'Открыть InsightBook',
    back: 'Вернуться ко входу',
    manual: 'Если приложение не открылось, переключитесь на него вручную.',
  },
  en: {
    success: 'Sign-in confirmed',
    linked: 'Yandex ID linked',
    cancelled: 'Sign-in cancelled',
    expired: 'Sign-in expired',
    failed: 'Could not continue',
    confirmed: 'Return to InsightBook to continue.',
    retry: 'To try again, start a new attempt in InsightBook.',
    open: 'Open InsightBook',
    back: 'Back to sign-in',
    manual: 'If the app does not open, switch to it manually.',
  },
  zh: {
    success: '登录已确认',
    linked: 'Yandex ID 已绑定',
    cancelled: '登录已取消',
    expired: '登录已过期',
    failed: '无法继续',
    confirmed: '请返回 InsightBook 继续操作。',
    retry: '如需重试，请在 InsightBook 中重新发起操作。',
    open: '打开 InsightBook',
    back: '返回登录',
    manual: '如果应用未打开，请手动切换到 InsightBook。',
  },
}

export type OAuthLocale = keyof typeof copy
export type OAuthResult = 'success' | 'linked' | 'cancelled' | 'expired' | 'failed'

export const oauthHeaders = {
  'Cache-Control': CACHE_PROFILES.shortPrivate,
  'Referrer-Policy': 'no-referrer',
}

export function getOAuthLocale(language?: string): OAuthLocale {
  const primary = language?.trim().toLowerCase().split(/[-_,;]/)[0]

  return primary === 'en' || primary === 'zh' ? primary : 'ru'
}

export function oauthResultPage(
  result: OAuthResult,
  locale: OAuthLocale,
  returnUrl: URL,
  native = false,
  status = 200,
) {
  const labels = copy[locale]
  const completed = result === 'success' || result === 'linked'
  const href = returnUrl.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  const mark = completed ? '✓' : result === 'cancelled' ? '–' : '!'

  return new Response(`<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${labels[result]} · InsightBook</title>
  <style>
    :root {
      color-scheme: light dark;
      --background: #f5efe5;
      --card: #fffcf7;
      --border: #e2d7c8;
      --text: #2b2723;
      --muted: #66584c;
      --button: #3b2d55;
      --button-text: #fff;
      --mark: #196247;
      --mark-bg: #dfefe4;
      --notice: #8a480f;
      --notice-bg: #faead7;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --background: #17141d;
        --card: #241f2c;
        --border: #42384d;
        --text: #f9f4f9;
        --muted: #c8bccd;
        --button: #e1d1fa;
        --button-text: #30203e;
        --mark: #95e2bb;
        --mark-bg: #213b34;
        --notice: #ffd19e;
        --notice-bg: #4a3328;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: 20px;
      padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right))
               max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
      background: var(--background);
      color: var(--text);
      font: 1rem/1.5 system-ui, sans-serif;
    }
    main {
      width: min(100%, 26rem);
      padding: clamp(22px, 6vw, 36px);
      border-radius: 24px;
      border: 1px solid var(--border);
      background: var(--card);
      box-shadow: 0 18px 48px rgb(0 0 0 / 8%);
    }
    .brand { font-weight: 700; margin-bottom: 28px; }
    .mark {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      color: var(--mark);
      background: var(--mark-bg);
      font-size: 1.6rem;
      font-weight: 700;
    }
    .notice { color: var(--notice); background: var(--notice-bg); }
    h1 { margin: 14px 0 8px; font-size: clamp(1.4rem, 5vw, 1.8rem); line-height: 1.2; }
    p { margin: 0; color: var(--muted); }
    a {
      display: block;
      margin-top: 24px;
      padding: 13px 16px;
      border-radius: 12px;
      background: var(--button);
      color: var(--button-text);
      text-align: center;
      text-decoration: none;
      font-weight: 650;
    }
    a:focus-visible { outline: 2px solid var(--text); outline-offset: 4px; }
    a:active { opacity: .82; }
    .hint { margin-top: 12px; font-size: .875rem; }
  </style>
</head>
<body>
  <main>
    <div class="brand">InsightBook</div>
    <div class="mark${completed ? '' : ' notice'}" aria-hidden="true">${mark}</div>
    <h1>${labels[result]}</h1>
    <p>${completed ? labels.confirmed : labels.retry}</p>
    <a href="${href}">${native ? labels.open : labels.back}</a>
    ${native ? `<p class="hint">${labels.manual}</p>` : ''}
  </main>
</body>
</html>`, {
    status,
    headers: {
      ...oauthHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': 'default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; frame-ancestors \'none\'',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
