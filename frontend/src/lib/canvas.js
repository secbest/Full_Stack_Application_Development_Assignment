// Geometry helpers for the service memo signature pad.
//
// A <canvas> has two independent sizes: its bitmap (the width/height attributes, in
// device pixels) and its rendered box (what CSS gives it). Drawing coordinates are in
// bitmap space, but pointer events report viewport coordinates. If the two sizes differ
// and you do not convert between them, ink lands away from the finger - which is exactly
// what a fixed 400x200 bitmap stretched by `w-full` does on a phone.
//
// Kept as pure functions rather than component internals so the conversion is testable
// without a real canvas implementation.

/**
 * Convert a pointer event's viewport coordinates into canvas bitmap coordinates.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} clientX  event.clientX
 * @param {number} clientY  event.clientY
 * @returns {{x: number, y: number}} position in bitmap space
 */
export function toCanvasPos(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect()

  // No layout yet (first paint, or a hidden ancestor). Dividing by zero here would put
  // NaN into every subsequent lineTo and blank the whole stroke, so bail to the origin.
  if (!rect.width || !rect.height) return { x: 0, y: 0 }

  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  }
}

/**
 * Match the canvas bitmap to its rendered box at native device resolution.
 *
 * Assigning width/height clears the canvas and resets all context state, so the caller
 * must treat a `true` return as "the pad is now blank" and re-apply stroke settings.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} dpr  device pixel ratio to render at
 * @returns {boolean} true only if the bitmap was actually resized
 */
export function resizeCanvasToDisplaySize(canvas, dpr = 1) {
  const rect = canvas.getBoundingClientRect()
  const width = Math.round(rect.width * dpr)
  const height = Math.round(rect.height * dpr)

  if (!width || !height) return false
  if (canvas.width === width && canvas.height === height) return false

  canvas.width = width
  canvas.height = height
  return true
}
