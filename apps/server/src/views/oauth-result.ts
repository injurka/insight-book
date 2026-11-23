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
      --paper: #f8f7ef;
      --edge: #d4dfd3;
      --ink: #142b23;
      --muted: #486158;
      --jade: #216550;
      --halo: #e1efe4;
      --button: #173e31;
      --button-text: #f8fff8;
      --notice: #805127;
      --notice-bg: #f4e6d3;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --paper: #111e1b;
        --edge: #334b42;
        --ink: #edf5ee;
        --muted: #acbeb5;
        --jade: #a0e2bf;
        --halo: #213e34;
        --button: #b8e9ca;
        --button-text: #132e23;
        --notice: #f3c28e;
        --notice-bg: #3f3023;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: 16px;
      padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
               max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      background: var(--paper);
      color: var(--ink);
      font: 1rem/1.5 system-ui, sans-serif;
    }
    main {
      width: min(100%, 30rem);
      text-align: center;
      padding: clamp(20px, 6vw, 38px);
      border: 1px solid var(--edge);
      border-radius: 28px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: .9rem;
      font-weight: 700;
      letter-spacing: .02em;
    }
    .brand i {
      width: 18px;
      height: 14px;
      border-radius: 3px;
      border: 1.5px solid currentColor;
      background: linear-gradient(90deg, transparent 46%, currentColor 46% 54%, transparent 54%);
      color: var(--jade);
    }
    .mark {
      display: grid;
      place-items: center;
      width: 112px;
      height: 112px;
      margin: clamp(20px, 6svh, 42px) auto 20px;
      border: 1px solid var(--edge);
      border-radius: 50%;
      background: radial-gradient(circle, var(--halo), transparent 73%);
      color: var(--jade);
    }
    .mark span {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--halo);
      font-size: 1.75rem;
      line-height: 1;
    }
    .notice { color: var(--notice); }
    .notice span { background: var(--notice-bg); }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(1.85rem, 7vw, 2.65rem);
      font-weight: 650;
      letter-spacing: -.045em;
      line-height: 1.08;
      text-wrap: balance;
    }
    p { margin: 0; color: var(--muted); text-wrap: pretty; }
    a {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 52px;
      margin-top: 24px;
      padding: 10px 16px;
      border-radius: 999px;
      background: var(--button);
      color: var(--button-text);
      text-decoration: none;
      font-weight: 650;
    }
    a:focus-visible { outline: 2px solid var(--ink); outline-offset: 4px; }
    a:active { opacity: .82; }
    .hint { margin-top: 14px; font-size: .8125rem; }
  </style>
</head>
<body>
  <main>
    <div class="brand"><i aria-hidden="true"></i>InsightBook</div>
    <div class="mark${completed ? '' : ' notice'}" aria-hidden="true"><span>${mark}</span></div>
    <h1>${labels[result]}</h1>
    <p>${completed ? labels.confirmed : labels.retry}</p>
    <a href="${href}">${native ? labels.open : labels.back}<span aria-hidden="true">→</span></a>
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
