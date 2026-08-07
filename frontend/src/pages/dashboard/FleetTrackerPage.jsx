import { useEffect, useRef, useState } from 'react'
import { MapPin, Maximize2, X } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { getCrewPositions } from '@/api/fieldOps'
import { FleetMap, STATUS_COLORS, STATUS_LABELS } from '@/components/FleetMap'

const POLL_MS = 30000
const STATUS_ORDER = ['available', 'en_route', 'on_scene', 'off_duty']
const STATUS_SUBTITLES = {
  available: 'Ready to be dispatched.',
  en_route: 'Currently travelling on a job.',
  on_scene: 'At the pickup or destination.',
  off_duty: 'Not logged in or inactive.',
}

// Matches ReportPage.jsx / Management.jsx exactly (raw inline styles per CLAUDE.md's
// design tokens) rather than the Tailwind/shadcn styling DashboardPage.jsx uses - two of
// the three Managing Director pages already follow this, and it's the one that matches
// the documented tokens (24px/700/#1E293B title, 32px content padding) literally.
const cardBase = { background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }

function StatCard({ statusKey, count }) {
  return (
    <div style={{ ...cardBase, padding: '20px 24px' }}>
      <p style={{ fontSize: 11, color: '#64748B', fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {STATUS_LABELS[statusKey]}
      </p>
      <span style={{ fontSize: 28, fontWeight: 700, color: STATUS_COLORS[statusKey], fontFamily: "'Inter', sans-serif", display: 'block', marginBottom: 6 }}>
        {count}
      </span>
      <p style={{ fontSize: 12, color: '#64748B', fontFamily: "'Inter', sans-serif" }}>{STATUS_SUBTITLES[statusKey]}</p>
    </div>
  )
}

// The default view is a minimap (fixed, modest height) so the map doesn't dominate the
// page the way it would at full size - Doris can expand it into this larger modal (same
// backdrop/dialog pattern as Management.jsx's AddUserModal) when she actually wants to
// read positions closely.
function ExpandedMapModal({ crew, onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fleet-map-expanded-heading"
        style={{ background: '#FFFFFF', borderRadius: 16, width: '90vw', maxWidth: 1100, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="fleet-map-expanded-heading" style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', fontFamily: "'Inter', sans-serif" }}>Fleet Tracker</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 6, display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ height: '75vh' }}>
          <FleetMap crew={crew} />
        </div>
      </div>
    </div>
  )
}

export default function FleetTrackerPage() {
  const [crew, setCrew] = useState([])
  const [status, setStatus] = useState('loading')
  const [expanded, setExpanded] = useState(false)
  const toast = useToast()
  const isMountedRef = useRef(true)

  async function load(isBackgroundRefresh) {
    if (!isBackgroundRefresh) setStatus('loading')
    try {
      const { data } = await getCrewPositions()
      if (isMountedRef.current) {
        setCrew(data.data)
        setStatus('ready')
      }
    } catch (err) {
      if (!isMountedRef.current) return
      if (!isBackgroundRefresh) setStatus('error')
      toast.error(err.response?.data?.message || 'Failed to load crew positions.')
    }
  }

  // Refresh every 30s so the map stays live, paused while the tab is hidden and
  // refetched immediately on becoming visible again - same idiom as NotificationBell.
  // Runs once on mount only: `load` isn't in the dep array on purpose (it's redefined
  // every render) - listing it would re-fire this effect, and thus re-fetch, on every
  // render instead of only every 30s/visibility change.
  useEffect(() => {
    isMountedRef.current = true
    load(false)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, POLL_MS)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') load(true)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      isMountedRef.current = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = crew.filter((c) => c.status === s).length
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 32, background: '#F8FAFC', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <MapPin size={20} color="#64748B" />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1E293B', fontFamily: "'Inter', sans-serif" }}>Fleet Tracker</h1>
      </div>

      {status === 'error' ? (
        <div style={{ ...cardBase, padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#64748B', fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>Couldn't load crew positions.</p>
          <button
            onClick={() => load(false)}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#1E293B', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          >
            Retry
          </button>
        </div>
      ) : status === 'loading' ? (
        <div style={{ ...cardBase, padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#64748B', fontFamily: "'Inter', sans-serif" }}>Loading fleet tracker...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            {STATUS_ORDER.map((s) => <StatCard key={s} statusKey={s} count={counts[s]} />)}
          </div>

          <div style={{ ...cardBase, padding: 0, overflow: 'hidden', position: 'relative' }}>
            <button
              onClick={() => setExpanded(true)}
              aria-label="Expand map"
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            >
              <Maximize2 size={16} color="#1E293B" />
            </button>
            <div style={{ height: 240 }}>
              <FleetMap crew={crew} />
            </div>
          </div>
        </div>
      )}

      {expanded && <ExpandedMapModal crew={crew} onClose={() => setExpanded(false)} />}
    </div>
  )
}
