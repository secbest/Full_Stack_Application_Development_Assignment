import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

let googleMapsPromise

function loadGoogleMaps(apiKey) {
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

export function LocationAutocomplete({ id, name, value, onChange, onBlur, placeholder }) {
  const containerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const onBlurRef = useRef(onBlur)
  const valueRef = useRef(value)
  const [status, setStatus] = useState('loading')
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onBlurRef.current = onBlur }, [onBlur])
  useEffect(() => { valueRef.current = value }, [value])

  useEffect(() => {
    if (!apiKey || !containerRef.current) return undefined

    let disposed = false
    let autocomplete
    let handleInput
    let handleBlur
    let handleSelect

    loadGoogleMaps(apiKey)
      .then(async (maps) => {
        const { PlaceAutocompleteElement } = await maps.importLibrary('places')
        if (disposed || !containerRef.current) return

        autocomplete = new PlaceAutocompleteElement({
          includedRegionCodes: ['sg'],
          locationBias: { center: { lat: 1.3521, lng: 103.8198 }, radius: 30000 },
          noInputIcon: true,
          requestedLanguage: 'en',
          requestedRegion: 'sg',
        })
        autocomplete.id = id
        autocomplete.name = name
        autocomplete.placeholder = placeholder
        autocomplete.value = valueRef.current || ''
        autocomplete.className = 'location-autocomplete'

        handleInput = () => onChangeRef.current(autocomplete.value || '')
        handleBlur = () => onBlurRef.current?.()
        handleSelect = async ({ placePrediction }) => {
          const selectedText = autocomplete.value || placePrediction?.text?.toString() || ''
          onChangeRef.current(selectedText)

          try {
            const place = placePrediction.toPlace()
            await place.fetchFields({ fields: ['formattedAddress'] })
            const address = place.formattedAddress || selectedText
            autocomplete.value = address
            onChangeRef.current(address)
          } catch {
            // The selected prediction remains usable even if Place Details is unavailable.
          }
        }

        autocomplete.addEventListener('input', handleInput)
        autocomplete.addEventListener('focusout', handleBlur)
        autocomplete.addEventListener('gmp-select', handleSelect)
        containerRef.current.appendChild(autocomplete)
        setStatus('ready')
      })
      .catch(() => setStatus('fallback'))

    return () => {
      disposed = true
      if (autocomplete) {
        autocomplete.removeEventListener('input', handleInput)
        autocomplete.removeEventListener('focusout', handleBlur)
        autocomplete.removeEventListener('gmp-select', handleSelect)
      }
    }
  }, [apiKey, id, name, placeholder])

  useEffect(() => {
    if (status !== 'ready') return
    const autocomplete = containerRef.current?.firstElementChild
    if (autocomplete && autocomplete.value !== value) autocomplete.value = value || ''
  }, [status, value])

  if (!apiKey) {
    return <Input id={id} name={name} autoComplete="street-address" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
  }

  return (
    <div>
      {status !== 'ready' && (
        <Input
          id={id}
          name={name}
          autoComplete="street-address"
          placeholder={status === 'loading' ? 'Loading location search…' : placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      )}
      <div ref={containerRef} className={status === 'ready' ? '' : 'hidden'} />
    </div>
  )
}
