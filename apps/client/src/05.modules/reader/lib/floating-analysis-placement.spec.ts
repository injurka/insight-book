import { describe, expect, it } from 'vitest'
import { placeFloatingAnalysis } from './floating-analysis-placement'

const desktop = { left: 0, width: 1920, contentWidth: 800, dialogWidth: 650 }

describe('floating analysis placement', () => {
  it('moves the reader only as far as needed when the dialog opens', () => {
    expect(placeFloatingAnalysis(desktop)).toEqual({ x: 1258, offset: -118 })
  })

  it('follows a dragged dialog without losing the small gap', () => {
    expect(placeFloatingAnalysis({ ...desktop, draggedX: 1200 })).toEqual({ x: 1200, offset: -176 })
    expect(placeFloatingAnalysis({ ...desktop, draggedX: 100 })).toEqual({ x: 100, offset: 206 })
  })

  it('docks an overlapping dialog when the reader cannot fit beside its dropped position', () => {
    expect(placeFloatingAnalysis({ ...desktop, draggedX: 635 })).toEqual({ x: 1258, offset: -118 })
  })

  it('uses every available pixel and leaves the reader alone when widths do not fit', () => {
    expect(placeFloatingAnalysis({ ...desktop, width: 1450 })).toEqual({ x: 800, offset: -325 })
    expect(placeFloatingAnalysis({ ...desktop, width: 1449 })).toBeNull()
  })
})
