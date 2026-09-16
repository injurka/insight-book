(() => {
  const CJK_MIN = 0x4E00
  let loaded = false
  let observer: MutationObserver | null = null

  function hasCJK(text: string | null): boolean {
    if (!text)
      return false

    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) >= CJK_MIN)
        return true
    }

    return false
  }

  function loadCjkCss() {
    if (loaded)
      return

    loaded = true
    observer?.disconnect()
    for (const weight of ['regular', 'medium', 'semibold']) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = new URL(`./fonts/split/${weight}/result-cjk.css`, document.baseURI).href
      document.head.appendChild(link)
    }
  }

  function checkNode(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
      if (hasCJK(node.textContent)) {
        loadCjkCss()

        return true
      }
    }

    return false
  }

  function init() {
    if (!document.body)
      return

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (hasCJK(node.textContent)) {
        loadCjkCss()

        return
      }

      node = walker.nextNode()
    }

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes) {
          if (checkNode(addedNode))
            return
        }

        if (mutation.type === 'characterData' && checkNode(mutation.target))
          return
      }
    })
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    window.addEventListener('load', init, { once: true })
  }

  if (document.body)
    init()
  else
    document.addEventListener('DOMContentLoaded', init, { once: true })
})()
