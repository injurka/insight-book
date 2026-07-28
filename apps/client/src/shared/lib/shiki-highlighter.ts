import type { ShikiRpcFunctions } from '~/workers/dedicated/shiki.worker'
import { createBirpc } from 'birpc'
import ShikiWorker from '~/workers/dedicated/shiki.worker?worker'

let rpcClient: ReturnType<typeof createBirpc<ShikiRpcFunctions>> | null = null

function getShikiRpc() {
  if (!rpcClient) {
    const worker = new ShikiWorker()

    rpcClient = createBirpc<ShikiRpcFunctions>({}, {
      post: data => worker.postMessage(data),
      on: data => worker.addEventListener('message', data),
    })
  }
  return rpcClient
}

/**
 * Сканирует контейнер на наличие блоков кода и подсвечивает их с использованием Web Worker
 */
export async function highlightCodeBlocks(container: HTMLElement, isDarkTheme = false): Promise<void> {
  const codeBlocks = container.querySelectorAll<HTMLElement>('pre code, pre[class*="language-"]')
  if (codeBlocks.length === 0)
    return

  const theme = isDarkTheme ? 'github-dark' : 'github-light'
  const processedPres = new Set<HTMLPreElement>()
  const tasks: Promise<void>[] = []

  const rpc = getShikiRpc()

  codeBlocks.forEach((el) => {
    const parentPre = el.closest('pre')
    if (!parentPre || processedPres.has(parentPre))
      return

    processedPres.add(parentPre)

    const codeEl = parentPre.querySelector('code') || parentPre
    const classNames = `${parentPre.className} ${codeEl.className}`
    const langMatch = classNames.match(/language-([\w-]+)/) || classNames.match(/lang-([\w-]+)/)

    let lang = 'javascript'
    if (langMatch && langMatch[1] && langMatch[1] !== 'undefined') {
      lang = langMatch[1]
    }

    const codeText = codeEl.textContent || ''
    if (!codeText.trim())
      return

    const task = rpc.highlightCode(codeText, lang, theme)
      .then((highlightedHtml) => {
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = highlightedHtml
        const newPre = tempDiv.firstElementChild as HTMLPreElement | null

        if (newPre) {
          Array.from(parentPre.attributes).forEach((attr) => {
            if (attr.name.startsWith('data-') && !newPre.hasAttribute(attr.name)) {
              newPre.setAttribute(attr.name, attr.value)
            }
          })
          parentPre.replaceWith(newPre)
        }
      })
      .catch((e) => {
        console.warn('[Shiki RPC] Failed to highlight block:', e)
      })

    tasks.push(task)
  })

  await Promise.all(tasks)
}
