import { useEffect, useState } from 'react'

// 767px, not 768px: Tailwind's `md:` utilities apply from 768px upwards, so a JS
// breakpoint has to be the pixel below it or the drawer state and the CSS layout
// disagree at exactly one width. Same reasoning for 1023px against `lg:`.
export const MOBILE_QUERY = '(max-width: 767px)'

// Below `lg` the 240px sidebar leaves under 500px of content, which is not enough for a
// six-column table or for two cards side by side - even though it is plenty for the
// static sidebar itself. Hence a second, wider breakpoint distinct from MOBILE_QUERY.
export const NARROW_QUERY = '(max-width: 1023px)'

/**
 * Subscribe to a media query and re-render when it starts or stops matching.
 *
 * Used where a breakpoint needs to be *state* rather than styling: choosing between two
 * different component trees (card list vs table), or driving an overlay that must close
 * on navigation and on Escape. CSS alone cannot express either.
 *
 * @param {string} query  media query to track
 * @returns {boolean} true while the query matches
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined

    const mediaQueryList = window.matchMedia(query)
    const handleChange = (event) => setMatches(event.matches)

    // Re-read on mount: the viewport can change between the initial render and this
    // effect (rotation during hydration, or a query prop change).
    setMatches(mediaQueryList.matches)
    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [query])

  return matches
}

/** True below Tailwind's `md` breakpoint - the app-shell drawer's cutoff. */
export function useIsMobile(query = MOBILE_QUERY) {
  return useMediaQuery(query)
}
