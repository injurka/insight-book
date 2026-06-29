import { hexToRgba } from '~/shared/lib/helpers'

function applyHighlight(textNodes: Text[], startIndex: number, endIndex: number, color: string) {
  let currentIndex = 0
  const marks: { mark: HTMLElement, parent: ParentNode | null }[] = []
  for (const textNode of textNodes) {
    const nodeStart = currentIndex
    const nodeEnd = currentIndex + (textNode.nodeValue?.length || 0)

    if (nodeEnd > startIndex && nodeStart < endIndex) {
      const overlapStart = Math.max(0, startIndex - nodeStart)
      const overlapEnd = Math.min(textNode.nodeValue!.length, endIndex - nodeStart)

      const originalText = textNode.nodeValue!
      const before = originalText.substring(0, overlapStart)
      const match = originalText.substring(overlapStart, overlapEnd)
      const after = originalText.substring(overlapEnd)

      const parent = textNode.parentNode as HTMLElement
      if (
        parent
        && parent.classList?.contains('word')
        && overlapStart === 0
        && overlapEnd === originalText.length
        && parent.childNodes.length === 1
      ) {
        parent.style.backgroundColor = hexToRgba(color, 0.35)
        parent.classList.add('exact-highlight')
        marks.push({ mark: parent, parent: null })
      }
      else {
        const fragment = document.createDocumentFragment()
        if (before)
          fragment.appendChild(document.createTextNode(before))
        if (match) {
          const mark = document.createElement('mark')
          mark.style.backgroundColor = hexToRgba(color, 0.35)
          mark.style.color = 'inherit'
          mark.className = 'exact-highlight'
          mark.textContent = match
          fragment.appendChild(mark)
          marks.push({ mark, parent: textNode.parentNode })
        }
        if (after)
          fragment.appendChild(document.createTextNode(after))

        parent?.replaceChild(fragment, textNode)
      }
    }
    currentIndex = nodeEnd
  }

  if (marks.length > 0) {
    const first = marks[0].mark
    const last = marks[marks.length - 1].mark

    first.style.borderTopLeftRadius = '4px'
    first.style.borderBottomLeftRadius = '4px'

    last.style.borderTopRightRadius = '4px'
    last.style.borderBottomRightRadius = '4px'

    for (let i = 0; i < marks.length; i++) {
      const { mark } = marks[i]
      if (mark.tagName.toLowerCase() === 'mark') {
        mark.style.paddingTop = '2px'
        mark.style.paddingBottom = '2px'
      }
    }
  }
}

export function highlightExactText(root: HTMLElement, textToHighlight: string, color: string) {
  if (!textToHighlight)
    return

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let node: Text | null
  const textNodes: Text[] = []
  // eslint-disable-next-line no-cond-assign, no-unmodified-loop-condition
  while ((node = walker.nextNode() as Text | null)) {
    textNodes.push(node)
  }

  const fullText = textNodes.map(n => n.nodeValue || '').join('')
  const startIndex = fullText.indexOf(textToHighlight)

  if (startIndex === -1) {
    const lowerFull = fullText.toLowerCase()
    const lowerSearch = textToHighlight.toLowerCase()
    const lowerStart = lowerFull.indexOf(lowerSearch)
    if (lowerStart === -1)
      return
    applyHighlight(textNodes, lowerStart, lowerStart + lowerSearch.length, color)
    return
  }

  applyHighlight(textNodes, startIndex, startIndex + textToHighlight.length, color)
}
