// Unit tests for the signature-pad canvas geometry helpers.
//
// These are pure functions on purpose. The bug they fix (pointer coordinates being fed
// into a bitmap of a different size than the element's rendered box) is arithmetic, and
// arithmetic is the one thing jsdom can decide honestly - it cannot evaluate CSS or
// actually rasterise a canvas. So the helpers take a canvas-shaped object and are tested
// directly, rather than through a rendered <canvas> whose layout jsdom would report as 0x0.
import { toCanvasPos, resizeCanvasToDisplaySize } from '@/lib/canvas'

/** Minimal stand-in for a <canvas>: the two bitmap dimensions plus its rendered box. */
function fakeCanvas({ width, height, rect }) {
  return {
    width,
    height,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: rect.width,
      height: rect.height,
      ...rect,
    }),
  }
}

describe('toCanvasPos', () => {
  it('scales pointer offsets by the bitmap-to-rect ratio', () => {
    // The pre-fix production case: a hard-coded 400x200 bitmap stretched by w-full into
    // the ~311px column a 375px phone gives it. A tap at the visual midpoint (155.5px)
    // has to land at the bitmap midpoint (200px), not at 155.5px.
    const canvas = fakeCanvas({ width: 400, height: 200, rect: { width: 311, height: 155.5 } })

    const { x, y } = toCanvasPos(canvas, 155.5, 77.75)

    expect(x).toBeCloseTo(200)
    expect(y).toBeCloseTo(100)
  })

  it('returns offsets unchanged when the bitmap already matches the rendered box', () => {
    const canvas = fakeCanvas({ width: 300, height: 150, rect: { width: 300, height: 150 } })

    expect(toCanvasPos(canvas, 42, 99)).toEqual({ x: 42, y: 99 })
  })

  it('subtracts the rect origin so a canvas below the fold still maps correctly', () => {
    // Scrolled down a long wizard step, the pad's top is far from the viewport top.
    const canvas = fakeCanvas({
      width: 200,
      height: 100,
      rect: { left: 20, top: 400, width: 200, height: 100 },
    })

    expect(toCanvasPos(canvas, 70, 450)).toEqual({ x: 50, y: 50 })
  })

  it('scales by devicePixelRatio when the bitmap is sized for a retina screen', () => {
    // After resizeCanvasToDisplaySize on a 2x phone: 311 CSS px -> 622 device px.
    const canvas = fakeCanvas({ width: 622, height: 320, rect: { width: 311, height: 160 } })

    const { x, y } = toCanvasPos(canvas, 100, 40)

    expect(x).toBeCloseTo(200)
    expect(y).toBeCloseTo(80)
  })

  it('returns the origin instead of NaN when the element has no layout yet', () => {
    // First paint, or a display:none ancestor - dividing by a zero-width rect would
    // otherwise poison every later lineTo with NaN and silently blank the pad.
    const canvas = fakeCanvas({ width: 400, height: 200, rect: { width: 0, height: 0 } })

    expect(toCanvasPos(canvas, 10, 10)).toEqual({ x: 0, y: 0 })
  })
})

describe('resizeCanvasToDisplaySize', () => {
  it('sizes the bitmap to the rendered box times the device pixel ratio', () => {
    const canvas = fakeCanvas({ width: 400, height: 200, rect: { width: 311, height: 160 } })

    const changed = resizeCanvasToDisplaySize(canvas, 2)

    expect(canvas.width).toBe(622)
    expect(canvas.height).toBe(320)
    expect(changed).toBe(true)
  })

  it('rounds fractional CSS sizes to whole device pixels', () => {
    const canvas = fakeCanvas({ width: 0, height: 0, rect: { width: 311.4, height: 155.6 } })

    resizeCanvasToDisplaySize(canvas, 1)

    expect(canvas.width).toBe(311)
    expect(canvas.height).toBe(156)
  })

  it('reports no change when the bitmap is already the right size', () => {
    // The caller clears the pad and warns the user on every true, so a no-op resize
    // must not be reported as a change - a stray ResizeObserver fire would otherwise
    // wipe a signature the crew had already drawn.
    const canvas = fakeCanvas({ width: 622, height: 320, rect: { width: 311, height: 160 } })

    expect(resizeCanvasToDisplaySize(canvas, 2)).toBe(false)
    expect(canvas.width).toBe(622)
  })

  it('leaves the bitmap alone when the element has no layout yet', () => {
    const canvas = fakeCanvas({ width: 400, height: 200, rect: { width: 0, height: 0 } })

    expect(resizeCanvasToDisplaySize(canvas, 2)).toBe(false)
    expect(canvas.width).toBe(400)
  })
})
