import { Fragment, useEffect, useState } from 'react'
import { History, Loader2, RefreshCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/context/ToastContext'
import { listServiceMemos, getServiceMemo } from '@/api/fieldOps'

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'invoiced', label: 'Invoiced' },
]

function ExpandedRow({ memoId }) {
  const [detail, setDetail] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    getServiceMemo(memoId)
      .then(({ data }) => { setDetail(data.data); setStatus('ready') })
      .catch(() => setStatus('error'))
  }, [memoId])

  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={6}>
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading memo details...
          </div>
        )}
        {status === 'error' && <p className="text-sm text-[#EF4444] py-2">Failed to load memo details.</p>}
        {status === 'ready' && (
          <div className="grid grid-cols-3 gap-6 py-3 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase text-muted-foreground">Job Info</p>
              <p>Start: {detail.job_start_time}</p>
              <p>End: {detail.job_end_time}</p>
              <p>Overtime: {detail.overtime_hours}h</p>
              <p>Evacuation floors: {detail.evacuation_floors}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase text-muted-foreground">Service &amp; Charges</p>
              <p>{detail.service_type} / {detail.transfer_type}</p>
              <p>Oxygen: {detail.oxygen_litres_used}L</p>
              <p>Waiting time: {detail.waiting_time_minutes} min</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase text-muted-foreground">Signature &amp; Stamp</p>
              {detail.signatures?.map((s) => (
                <p key={s.id}>{s.signer_name} - {s.is_waived ? `Waived (${s.waiver_reason})` : 'Signed'}</p>
              ))}
              <p>Stamp: {detail.hospital_stamp_image_url ? 'Attached' : 'None'}</p>
            </div>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

export default function MemoHistoryPage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('loading')
  const [expandedId, setExpandedId] = useState(null)
  const toast = useToast()

  async function load() {
    setStatus('loading')
    try {
      const params = { page, limit: 20 }
      if (statusFilter !== 'all') params.status = statusFilter
      const { data } = await listServiceMemos(params)
      setResult(data.data)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      toast.error(err.response?.data?.message || 'Failed to load memo history.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <History className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Memo History</h1>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
        <TabsList>
          {STATUS_FILTERS.map((f) => <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      )}

      {status === 'error' && (
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Couldn't load memo history.</p>
            <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="w-4 h-4 mr-2" /> Retry</Button>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && result.data.length === 0 && (
        <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">No memos found.</CardContent></Card>
      )}

      {status === 'ready' && result.data.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((memo) => (
                <Fragment key={memo.id}>
                  <TableRow className="cursor-pointer" onClick={() => setExpandedId(expandedId === memo.id ? null : memo.id)}>
                    <TableCell>#{memo.booking_id}</TableCell>
                    <TableCell>{memo.patient_name}</TableCell>
                    <TableCell>{memo.hospital_destination}</TableCell>
                    <TableCell>{memo.service_type}</TableCell>
                    <TableCell><StatusBadge status={memo.status} /></TableCell>
                    <TableCell>{new Date(memo.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                  {expandedId === memo.id && <ExpandedRow memoId={memo.id} />}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-xs text-muted-foreground">Page {result.pagination.page} of {result.pagination.total_pages || 1}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= result.pagination.total_pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
