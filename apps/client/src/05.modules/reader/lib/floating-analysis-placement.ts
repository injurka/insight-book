const GAP = 16
const EDGE = 12

interface PlacementInput {
  left: number
  width: number
  contentWidth: number
  dialogWidth: number
  draggedX?: number
}

interface Placement {
  x: number
  offset: number
}

function placeDragged(
  x: number,
  dialogWidth: number,
  contentLeft: number,
  contentRight: number,
  minX: number,
  maxRight: number,
  gap: number,
  leftPlacement: Placement,
  rightPlacement: Placement,
): Placement {
  const inBounds = x >= minX && x + dialogWidth <= maxRight
  const leftOffset = Math.min(0, x - gap - contentRight)
  const rightOffset = Math.max(0, x + dialogWidth + gap - contentLeft)
  const fitsLeft = inBounds && contentLeft + leftOffset >= minX
  const fitsRight = inBounds && contentRight + rightOffset <= maxRight

  if (fitsLeft && (!fitsRight || Math.abs(leftOffset) <= rightOffset))
    return { x, offset: leftOffset }
  if (fitsRight)
    return { x, offset: rightOffset }

  return Math.abs(rightPlacement.x - x) <= Math.abs(leftPlacement.x - x) ? rightPlacement : leftPlacement
}

export function placeFloatingAnalysis(input: PlacementInput): Placement | null {
  const {
    left,
    width,
    contentWidth,
    dialogWidth,
    draggedX,
  } = input
  const free = width - contentWidth - dialogWidth
  if (free < 0)
    return null

  const gap = Math.min(GAP, free)
  const edge = Math.min(EDGE, (free - gap) / 2)
  const minX = left + edge
  const maxRight = left + width - edge
  const contentLeft = left + (width - contentWidth) / 2
  const contentRight = contentLeft + contentWidth
  const rightX = Math.min(contentRight + gap, maxRight - dialogWidth)
  const leftX = Math.max(minX, contentLeft - gap - dialogWidth)
  const rightPlacement = { x: rightX, offset: Math.min(0, rightX - gap - contentRight) }
  const leftPlacement = { x: leftX, offset: Math.max(0, leftX + dialogWidth + gap - contentLeft) }

  if (draggedX === undefined)
    return Math.abs(rightPlacement.offset) <= leftPlacement.offset ? rightPlacement : leftPlacement

  return placeDragged(
    draggedX,
    dialogWidth,
    contentLeft,
    contentRight,
    minX,
    maxRight,
    gap,
    leftPlacement,
    rightPlacement,
  )
}
