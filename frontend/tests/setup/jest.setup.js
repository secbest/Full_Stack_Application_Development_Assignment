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
