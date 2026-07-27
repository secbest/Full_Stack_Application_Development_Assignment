// Tests for the breakpoint hook behind the responsive app shell.
//
// The matchMedia stub in tests/setup/jest.setup.js answers `(max-width: Npx)` against
// window.innerWidth, and setTestViewportWidth() resizes it and fires `change` the way a
// browser would - so these tests exercise the real subscribe/update/unsubscribe path
// rather than asserting on a hand-fed mock.
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '@/hooks/useIsMobile'

const DESKTOP = 1280
const PHONE = 375

afterEach(() => {
  setTestViewportWidth(DESKTOP)
})

describe('useIsMobile', () => {
  it('reports mobile on a phone-width viewport', () => {
    setTestViewportWidth(PHONE)

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)
  })

  it('reports desktop above the md breakpoint', () => {
    setTestViewportWidth(DESKTOP)

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)
  })

  it('treats 767px as mobile and 768px as desktop', () => {
    // Tailwind's `md:` utilities apply from 768px up, so the hook's cutoff has to sit at
    // 767px or the JS drawer and the CSS layout disagree by one pixel.
    // Each width gets its own mount/unmount so a resize never notifies a hook left over
    // from the previous assertion (which would update state outside act()).
    setTestViewportWidth(767)
    const atPhone = renderHook(() => useIsMobile())
    expect(atPhone.result.current).toBe(true)
    atPhone.unmount()

    setTestViewportWidth(768)
    const atDesktop = renderHook(() => useIsMobile())
    expect(atDesktop.result.current).toBe(false)
    atDesktop.unmount()
  })

  it('updates when the viewport crosses the breakpoint', () => {
    setTestViewportWidth(DESKTOP)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      setTestViewportWidth(PHONE)
    })

    expect(result.current).toBe(true)
  })

  it('unsubscribes its listener on unmount', () => {
    setTestViewportWidth(PHONE)
    const { unmount } = renderHook(() => useIsMobile())

    const live = [...getTestQueryLists()].filter((mql) => mql.listenerCount() > 0)
    expect(live.length).toBeGreaterThan(0)

    unmount()

    expect(live.every((mql) => mql.listenerCount() === 0)).toBe(true)
  })
})
