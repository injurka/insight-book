import bgPrimaryUrl from '../../../assets/bg_primary.png'
import boardFrameUrl from '../../../assets/research-board/frame.webp'
import boardParchmentUrl from '../../../assets/research-board/parchment.webp'
import buttonDisabledUrl from '../../../assets/ui-kit/square-button/disabled.png'
import buttonHoverUrl from '../../../assets/ui-kit/square-button/hover.png'
import buttonNormalUrl from '../../../assets/ui-kit/square-button/normal.png'
import buttonPressedUrl from '../../../assets/ui-kit/square-button/pressed.png'
import infoParchmentUrl from '../../../assets/sidebar/info-parchment.png'
import panelArtUrl from '../../../assets/sidebar/parchment-art.webp'
import panelFrameUrl from '../../../assets/sidebar/pixel-wood-frame.webp'
import popoverPaperUrl from '../../../assets/sidebar/popover-paper-tile.webp'
import popoverParchmentUrl from '../../../assets/sidebar/popover-parchment.webp'

/**
 * Полный манифест текстур игры.
 *
 * Изображения импортируются явно, потому что Vite отдаёт тем же путям те же
 * самые URL, что попадают в собранный CSS (`url(...)`). Предзагрузка греет
 * ровно те файлы, которые потом нужны рендеру, и ни одна текстура не
 * догружается уже «на глазах» игрока: без мигания фонов, рамок, пергамента и
 * кнопок при первом наведении.
 */
export const GAME_TEXTURES = {
  background: bgPrimaryUrl,
  boardParchment: boardParchmentUrl,
  boardFrame: boardFrameUrl,
  panelParchment: panelArtUrl,
  panelFrame: panelFrameUrl,
  panelInfo: infoParchmentUrl,
  popoverParchment: popoverParchmentUrl,
  popoverPaper: popoverPaperUrl,
  buttonNormal: buttonNormalUrl,
  buttonHover: buttonHoverUrl,
  buttonPressed: buttonPressedUrl,
  buttonDisabled: buttonDisabledUrl,
} as const

export type GameTextureName = keyof typeof GAME_TEXTURES

export interface GameAssetsProgress {
  /** Сколько ресурсов уже готово. */
  loaded: number
  /** Всего ресурсов: текстуры + шрифт интерфейса. */
  total: number
  /** Готовность 0..1 — для полосы загрузки. */
  ratio: number
}

/**
 * Декодированные изображения держим живыми: пока Image в памяти, браузер не
 * вытесняет готовый растр, и первый кадр рисуется без повторного декодирования.
 */
const decodedTextures = new Map<string, HTMLImageElement>()

/** Потолок ожидания: показать игру без одной текстуры лучше, чем застрять на экране загрузки. */
const PRELOAD_TIMEOUT_MS = 12_000

/**
 * Шрифт интерфейса: у Maple Mono CN сотни CJK-сабсетов, предзагрузка всего
 * шрифта вытянула бы десятки мегабайт. Грузим только знаки, которыми набран
 * интерфейс — кириллицу, латиницу, цифры и пунктуацию.
 */
const GAME_FONT_FAMILY = 'Maple Mono CN'
const GAME_FONT_WEIGHTS = ['400', '500', '600']
const GAME_FONT_SAMPLE
  = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя'
    + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    + '«»“”„()[]{}.,:;!?—–…+-=*/%'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Гарантирует, что ожидание внешнего ресурса не растянет загрузку бесконечно. */
export function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([promise.then(() => {}), delay(ms)])
}

function loadTexture(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()

    const finish = (ok: boolean) => {
      image.onload = null
      image.onerror = null
      decodedTextures.set(url, image)
      resolve(ok)
    }

    image.onerror = () => finish(false)
    image.onload = () => {
      // decode() гарантирует, что растр уже готов к отрисовке, а не «появится
      // на следующем кадре» — именно это и убирает мигание.
      if (typeof image.decode === 'function')
        image.decode().then(() => finish(true), () => finish(true))
      else
        finish(true)
    }

    image.src = url
  })
}

async function loadGameFont(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load)
    return

  await Promise.all(GAME_FONT_WEIGHTS.map(
    weight => document.fonts.load(`${weight} 16px "${GAME_FONT_FAMILY}"`, GAME_FONT_SAMPLE),
  ))
}

/**
 * Готовит все текстуры и шрифт интерфейса до первого кадра игры.
 * Промис завершается, когда всё загружено и декодировано (или когда истёк
 * потолок ожидания) — вызывающий код по нему снимает экран загрузки.
 */
export async function preloadGameAssets(
  onProgress?: (progress: GameAssetsProgress) => void,
): Promise<void> {
  const urls = Object.values(GAME_TEXTURES)
  const total = urls.length + 1 // + шрифт интерфейса
  let loaded = 0

  const report = () => {
    onProgress?.({ loaded, total, ratio: loaded / total })
  }

  report()

  const textures = Promise.all(urls.map(async (url) => {
    const ok = await loadTexture(url)
    if (!ok)
      console.warn(`[scroll-study] не удалось загрузить текстуру: ${url}`)
    loaded += 1
    report()
  }))

  const font = loadGameFont()
    .catch(() => undefined)
    .then(() => {
      loaded += 1
      report()
    })

  await withTimeout(Promise.all([textures, font]), PRELOAD_TIMEOUT_MS)
}
