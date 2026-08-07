import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/googleMaps'

const SINGAPORE_CENTER = { lat: 1.3521, lng: 103.8198 }

export const STATUS_COLORS = { available: '#22C55E', en_route: '#F59E0B', on_scene: '#3B82F6', off_duty: '#94A3B8' }
export const STATUS_LABELS = { available: 'Available', en_route: 'En Route', on_scene: 'On Scene', off_duty: 'Off Duty' }

// Classic map-pin (teardrop) outline, anchored at its bottom tip - a flat colored circle
// read as map clutter at a glance; this reads immediately as "a pin", just like Google's
// own default red marker, but colored per status.
const PIN_PATH = 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1 1 10,-30 C 10,-22 2,-20 0,0 z'

// First name only, and floated above the pin's head via labelOrigin - identifying which
// crew member a pin belongs to shouldn't require clicking it first, and a full name would
// crowd adjacent pins once several crew are near each other (e.g. idle at HQ).
function firstName(fullName) {
  return fullName.split(' ')[0]
}

function formatLastUpdated(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function infoWindowContent(member) {
  return `
    <div style="font-family: Inter, sans-serif; font-size: 13px; min-width: 160px;">
      <div style="font-weight: 600; color: #1E293B;">${member.name}</div>
      <div style="color: #64748B; margin-top: 2px;">${STATUS_LABELS[member.status] || member.status}</div>
      ${member.current_job_reference ? `<div style="color: #64748B;">Job: ${member.current_job_reference}</div>` : ''}
      <div style="color: #94A3B8; font-size: 11px; margin-top: 4px;">Updated ${formatLastUpdated(member.last_updated)}</div>
    </div>
  `
}

// Renders crew pins with the classic google.maps.Marker rather than AdvancedMarkerElement -
// the latter requires a Cloud-Console Map ID this project doesn't have, and a colored
// circle symbol is all this view needs. Markers are updated in place (position/icon) across
// polls instead of destroyed and recreated, so an open InfoWindow doesn't get yanked shut
// mid-view every 30s.
export function FleetMap({ crew }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const memberDataRef = useRef(new Map())
  const infoWindowRef = useRef(null)
  const hasFitBoundsRef = useRef(false)
  const [status, setStatus] = useState('loading')
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    if (!apiKey || !containerRef.current) return undefined
    let disposed = false
    let resizeObserver

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (disposed || !containerRef.current) return
        mapRef.current = new maps.Map(containerRef.current, {
          center: SINGAPORE_CENTER,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        infoWindowRef.current = new maps.InfoWindow()
        setStatus('ready')

        // Google Maps only measures its container once, at construction. When this
        // component is the one inside the expand-map modal, the dialog's layout hasn't
        // always settled to its final size by then, so the map renders tiles for a
        // stale (often much smaller) box - most of the visible area stays blank until
        // told to re-measure. Re-triggering 'resize' on every size change (not just once)
        // covers both that initial layout race and the browser window being resized later.
        resizeObserver = new ResizeObserver(() => {
          if (!mapRef.current) return
          const center = mapRef.current.getCenter()
          maps.event.trigger(mapRef.current, 'resize')
          if (center) mapRef.current.setCenter(center)
        })
        resizeObserver.observe(containerRef.current)
      })
      .catch(() => setStatus('fallback'))

    return () => {
      disposed = true
      resizeObserver?.disconnect()
    }
  }, [apiKey])

  useEffect(() => {
    if (status !== 'ready' || !window.google) return
    const maps = window.google.maps
    const map = mapRef.current
    const seenIds = new Set()

    crew.forEach((member) => {
      seenIds.add(member.id)
      memberDataRef.current.set(member.id, member)

      const icon = {
        path: PIN_PATH,
        anchor: new maps.Point(0, 0),
        // Symbol.labelOrigin (distinct from the deprecated Icon.labelOrigin, which
        // ignores symbol paths) positions the label above the pin's rounded head
        // instead of centered on its anchor tip.
        labelOrigin: new maps.Point(0, -36),
        scale: 1.4,
        fillColor: STATUS_COLORS[member.status] || STATUS_COLORS.off_duty,
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 1.5,
      }
      const label = {
        text: firstName(member.name),
        color: '#1E293B',
        fontSize: '11px',
        fontWeight: '600',
        className: 'efar-crew-label',
      }

      let marker = markersRef.current.get(member.id)
      if (!marker) {
        marker = new maps.Marker({ map, position: member.position, icon, label, title: member.name })
        marker.addListener('click', () => {
          infoWindowRef.current.setContent(infoWindowContent(memberDataRef.current.get(member.id)))
          infoWindowRef.current.open({ map, anchor: marker })
        })
        markersRef.current.set(member.id, marker)
      } else {
        marker.setPosition(member.position)
        marker.setIcon(icon)
      }
    })

    // Drop markers for crew no longer present - the roster is effectively fixed, but this
    // keeps the map correct if it ever isn't.
    for (const [id, marker] of markersRef.current) {
      if (!seenIds.has(id)) {
        marker.setMap(null)
        markersRef.current.delete(id)
      }
    }

    // Fit the viewport to wherever the crew actually are, once, the first time real
    // positions arrive - the fixed Singapore-wide center/zoom the map opens with can
    // easily leave every crew member (e.g. all idle at HQ, off in one corner) outside
    // the visible area entirely. Only once, not on every poll, so panning/zooming to
    // inspect a marker isn't yanked back every 30s.
    if (!hasFitBoundsRef.current && crew.length > 0) {
      hasFitBoundsRef.current = true
      const bounds = new maps.LatLngBounds()
      crew.forEach((member) => bounds.extend(member.position))
      map.fitBounds(bounds, 60)
      maps.event.addListenerOnce(map, 'bounds_changed', () => {
        // A single tight cluster (e.g. everyone idle at HQ) can fit-zoom in absurdly far
        // (street level) - cap it so the map still reads as "the map", not one building.
        if (map.getZoom() > 15) map.setZoom(15)
      })
    }
  }, [status, crew])

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Google Maps API key is not configured.
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground bg-white/60">
          Loading map...
        </div>
      )}
      {status === 'fallback' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground bg-white/60">
          Map could not be loaded.
        </div>
      )}
      <div ref={containerRef} className="w-full h-full rounded-lg" />

      {/* Google renders the marker label as a plain <div> with this className - styled
          globally here (same pattern as ReportPage.jsx's Recharts outline override)
          since it can't be reached via a CSS module/scoped class. */}
      <style>{`
        .efar-crew-label {
          background: #FFFFFF;
          padding: 1px 6px;
          border-radius: 6px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
          white-space: nowrap;
          font-family: 'Inter', sans-serif;
        }
      `}</style>
    </div>
  )
}
