// Owner: Kwan Hua (Xero Foundation)
// Xero Integration Settings (screen 18): connected/disconnected states, token expiry
// warning, sync overview. Connect/disconnect actions are Managing-Director-only (UC-01
// actor is "Admin/Managing Director") - AP/AR specialists see a read-only status card.
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plug, CheckCircle2, XCircle, AlertTriangle, ArrowRight, History } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks'
import { getXeroStatus, getXeroConnectUrl, disconnectXero } from '@/api/xero'

const CALLBACK_ERROR_MESSAGES = {
  access_denied: 'Xero connection was not authorised. Please try again and accept the required permissions.',
  invalid_state: 'The connection request expired or was tampered with. Please restart the connection flow.',
  code_expired: 'The authorisation code expired before it could be exchanged. Please restart the connection flow.',
  token_exchange_failed: 'Xero rejected the token exchange. Please restart the connection flow.',
}

export default function XeroConnectPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const isAdmin = user?.role === 'managing_director'

  async function load() {
    setLoading(true)
    try {
      setStatus(await getXeroStatus())
    } catch {
      toast.error('Failed to load Xero connection status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Handle the OAuth2 callback redirect (?connected=true or ?error=...), then strip the
  // query string so a page refresh doesn't re-fire the toast.
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      toast.success('Xero connected successfully.')
      setSearchParams({}, { replace: true })
      load()
    } else if (searchParams.get('error')) {
      const code = searchParams.get('error')
      toast.error(CALLBACK_ERROR_MESSAGES[code] || 'Failed to connect to Xero. Please try again.')
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConnect() {
    setBusy(true)
    try {
      const authUrl = await getXeroConnectUrl()
      window.location.href = authUrl
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start the Xero connection flow.')
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    setBusy(true)
    try {
      await disconnectXero()
      toast.success('Xero disconnected.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disconnect Xero.')
    } finally {
      setBusy(false)
    }
  }

  const expiryMs = status?.token_expiry ? new Date(status.token_expiry).getTime() : null
  const isExpired = expiryMs !== null && expiryMs <= Date.now()
  const expiringSoon = expiryMs !== null && !isExpired && expiryMs - Date.now() < 24 * 60 * 60 * 1000

  return (
    <div className="p-6 space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plug className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">Xero Connection</h1>
        </div>
        <button onClick={() => navigate('/xero/sync-status')} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-sm font-medium transition-all">
          <History size={16} /> View Sync Status
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Xero OAuth2 Status</CardTitle>
          <CardDescription>Connect EFAR to Xero to enable AP bill and AR invoice sync.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && status?.mode && (
            <div
              data-testid="xero-mode"
              className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                status.mode.simulated
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-blue-200 bg-blue-50 text-blue-800'
              }`}
            >
              <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold tracking-wide">
                {status.mode.label}
              </span>
              <span>{status.mode.detail}</span>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : status?.is_connected ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 size={16} /> Connected to <span className="font-semibold">{status.xero_org_name}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <Row label="Xero Organisation" value={status.xero_org_name} />
                <Row label="Tenant ID" value={status.xero_tenant_id} mono />
                <Row label="Connected Since" value={new Date(status.connected_at).toLocaleString()} />
                <Row label="Token Expiry" value={new Date(status.token_expiry).toLocaleString()} />
              </div>

              {isExpired && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                  <AlertTriangle size={14} /> Access token has expired. It will auto-refresh on the next sync; reconnect only if that refresh fails.
                </div>
              )}
              {!isExpired && expiringSoon && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle size={14} /> Token expires within 24 hours. It will auto-refresh on the next sync.
                </div>
              )}

              {isAdmin ? (
                <button onClick={handleDisconnect} disabled={busy} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-500 disabled:opacity-40">
                  <XCircle size={16} /> Disconnect Xero
                </button>
              ) : (
                <p className="text-xs text-slate-500">Only the Managing Director can reconnect or disconnect the Xero organisation.</p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <XCircle size={16} className="text-slate-400" /> Not connected to Xero
              </div>
              {isAdmin ? (
                <button onClick={handleConnect} disabled={busy} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">
                  <ArrowRight size={16} /> {busy ? 'Redirecting to Xero…' : 'Connect to Xero'}
                </button>
              ) : (
                <p className="text-xs text-slate-500">Ask the Managing Director to connect the platform to Xero before syncing invoices.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={`text-sm text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</div>
    </div>
  )
}
