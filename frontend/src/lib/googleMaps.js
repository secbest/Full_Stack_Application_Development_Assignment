// Shared Google Maps JS API loader - injects the <script> tag once and caches the
// in-flight promise, so multiple consumers (LocationAutocomplete's Places widget, the
// Fleet Tracker's rendered map) never race to load the script twice.
let googleMapsPromise

export function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps)
  if (googleMapsPromise) return googleMapsPromise

  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = '__efarGoogleMapsReady'
    const script = document.createElement('script')
    const params = new URLSearchParams({ key: apiKey, loading: 'async', callback: callbackName, v: 'weekly' })

    window[callbackName] = () => {
      delete window[callbackName]
      resolve(window.google.maps)
    }
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.onerror = () => {
      delete window[callbackName]
      googleMapsPromise = undefined
      reject(new Error('Google Maps could not be loaded.'))
    }
    document.head.appendChild(script)
  })

  return googleMapsPromise
}
