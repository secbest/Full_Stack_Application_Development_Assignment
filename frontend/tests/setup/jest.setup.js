// Shared Jest setup for the whole frontend test suite (not per-student) - runs after
// the test framework is installed in the jsdom environment, before every test file.
import '@testing-library/jest-dom'

// jsdom implements neither of these, but Radix UI's <Select> (used by ContractFormPage
// and others) calls both when opening/closing its popover. Without these no-op
// implementations, clicking a Select trigger throws "not a function" before the
// dropdown ever renders, regardless of what the test is actually checking.
window.HTMLElement.prototype.scrollIntoView = jest.fn()
window.HTMLElement.prototype.hasPointerCapture = jest.fn(() => false)
window.HTMLElement.prototype.releasePointerCapture = jest.fn()

// jsdom has no ResizeObserver either - Radix's Popper (used to position the open
// <SelectContent> dropdown) creates one to track the trigger's size. Without this stub,
// opening the Select throws and the dropdown's items never mount.
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom implements no window.matchMedia whatsoever, so any component calling it (the
// responsive AppLayout shell via useIsMobile) throws before rendering. This stub answers
// `(max-width: Npx)` and `(min-width: Npx)` queries against window.innerWidth, which
// jsdom defaults to 1024 - i.e. desktop unless a test says otherwise, so existing tests
// are unaffected. Use setTestViewportWidth() below to simulate a phone.
if (!window.matchMedia) {
  const queryLists = new Set()

  const evaluate = (query) => {
    const max = /\(\s*max-width:\s*(\d+(?:\.\d+)?)px\s*\)/.exec(query)
    if (max) return window.innerWidth <= parseFloat(max[1])
    const min = /\(\s*min-width:\s*(\d+(?:\.\d+)?)px\s*\)/.exec(query)
    if (min) return window.innerWidth >= parseFloat(min[1])
    return false
  }

  window.matchMedia = (query) => {
    const listeners = new Set()
    const mql = {
      media: query,
      get matches() {
        return evaluate(query)
      },
      addEventListener: (type, listener) => {
        if (type === 'change') listeners.add(listener)
      },
      removeEventListener: (type, listener) => {
        if (type === 'change') listeners.delete(listener)
      },
      // Safari < 14 API surface, kept so a polyfilled consumer still works.
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => listeners.delete(listener),
      notify: () => listeners.forEach((l) => l({ matches: mql.matches, media: query })),
      listenerCount: () => listeners.size,
    }
    queryLists.add(mql)
    return mql
  }

  // Resize the simulated viewport and fire `change` on every live query list, the way a
  // browser would. Exposed globally so any student's test can drive a breakpoint.
  global.setTestViewportWidth = (width) => {
    window.innerWidth = width
    queryLists.forEach((mql) => mql.notify())
  }

  // Tests that opened query lists should not leak listeners into the next file.
  global.getTestQueryLists = () => queryLists
}

// jsdom has no PointerEvent constructor at all - @testing-library/user-event's
// pointer() helper (used internally by click()) needs one to exist on window for
// Radix's pointer-based interactions (e.g. SelectItem selection) to fire.
if (!window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    constructor(type, props) {
      super(type, props)
      this.pointerId = props?.pointerId ?? 1
      this.pointerType = props?.pointerType ?? 'mouse'
    }
  }
  window.PointerEvent = PointerEvent
}
