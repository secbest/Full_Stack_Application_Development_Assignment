import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, History, Loader2, RefreshCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/context/ToastContext'
import { useMediaQuery, NARROW_QUERY } from '@/hooks'
import { listServiceMemos } from '@/api/fieldOps'
import MemoDetailGrid from './MemoDetailGrid'

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'invoiced', label: 'Invoiced' },
]

/**
 * Page controls, shared by both presentations.
 *
 * On desktop this sits inside the table's own Card exactly as it did before, so that
 * layout is untouched; on mobile it becomes its own card below the list. Defining it once
 * avoids both duplicated markup and the negative-margin trick that faking a single card
 * would otherwise need.
 */
function PaginationBar({ page, pagination, onPrev, onNext, className = '' }) {
  return (
    <div className={`flex flex-col items-stretch gap-3 p-4 md:flex-row md:items-center md:justify-between ${className}`}>
      <p className="text-xs text-muted-foreground text-center md:text-left">
        Page {pagination.page} of {pagination.total_pages || 1}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev} className="flex-1 h-11 md:flex-none md:h-9">Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= pagination.total_pages} onClick={onNext} className="flex-1 h-11 md:flex-none md:h-9">Next</Button>
      </div>
    </div>
  )
}

/** Desktop: the expanded detail spans the full width of the six-column table. */
function ExpandedRow({ memoId }) {
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={6}>
        <MemoDetailGrid memoId={memoId} />
      </TableCell>
    </TableRow>
  )
}

/**
 * Mobile: one card per memo carrying all six table columns, stacked.
 *
 * A real <button> rather than a clickable div, so the row is keyboard operable and
 * screen readers announce the expanded state - the desktop table row it replaces was
 * only mouse-clickable.
 */
function MemoCard({ memo, expanded, onToggle }) {
  return (
    <Card data-testid={`memo-card-${memo.id}`} className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left p-4 space-y-1.5 hover:bg-[#F1F5F9] transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="font-medium text-foreground">{memo.patient_name}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={memo.status} />
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
          <span>Booking #{memo.booking_id}</span>
          <span aria-hidden="true">-</span>
          <span>{memo.service_type}</span>
        </div>
        <p className="text-sm text-muted-foreground break-words">{memo.hospital_destination}</p>
        <p className="text-xs text-muted-foreground">{new Date(memo.created_at).toLocaleString()}</p>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-2">
          <MemoDetailGrid memoId={memo.id} />
        </div>
      )}
    </Card>
  )
}

export default function MemoHistoryPage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('loading')
  const [expandedId, setExpandedId] = useState(null)
  const toast = useToast()

  // Six columns (Booking / Patient / Destination / Service / Status / Submitted) cannot
  // compress to a phone. Rather than scroll the table sideways or drop columns, the same
  // data is rendered as a card list.
  //
  // The cutoff is `lg`, not `md`: at 768px the 240px sidebar leaves about 464px, and a
  // real browser clipped the last column inside the card's overflow-hidden - data loss
  // that no document-level overflow check can see. The table only earns its keep from
  // 1024px up. The app-shell drawer keeps its own, narrower `md` cutoff, because a 768px
  // tablet has plenty of room for the sidebar itself.
  const isNarrow = useMediaQuery(NARROW_QUERY)

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

  function toggleExpanded(memoId) {
    setExpandedId((current) => (current === memoId ? null : memoId))
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <History className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-xl md:text-2xl font-semibold text-foreground">Memo History</h1>
      </div>

      {/* Four filters in a 2x2 grid on a phone - see MyJobsPage for the same treatment. */}
      <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
        <TabsList className="grid w-full grid-cols-2 gap-1 rounded-2xl md:inline-flex md:w-auto md:rounded-full">
          {STATUS_FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="py-2.5 md:py-1.5">{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      )}

      {status === 'error' && (
        <Card>
          <CardContent className="p-4 md:p-6 flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <p className="text-sm text-muted-foreground">Couldn't load memo history.</p>
            <Button variant="outline" size="sm" onClick={load} className="w-full h-11 md:w-auto md:h-9">
              <RefreshCcw className="w-4 h-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && result.data.length === 0 && (
        <Card><CardContent className="p-8 md:p-12 text-center text-sm text-muted-foreground">No memos found.</CardContent></Card>
      )}

      {status === 'ready' && result.data.length > 0 && (
        <>
          {isNarrow ? (
            <>
              <div className="space-y-3">
                {result.data.map((memo) => (
                  <MemoCard
                    key={memo.id}
                    memo={memo}
                    expanded={expandedId === memo.id}
                    onToggle={() => toggleExpanded(memo.id)}
                  />
                ))}
              </div>
              <Card>
                <PaginationBar
                  page={page}
                  pagination={result.pagination}
                  onPrev={() => setPage((p) => p - 1)}
                  onNext={() => setPage((p) => p + 1)}
                />
              </Card>
            </>
          ) : (
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
                      <TableRow className="cursor-pointer" onClick={() => toggleExpanded(memo.id)}>
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
              <PaginationBar
                page={page}
                pagination={result.pagination}
                onPrev={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
                className="border-t"
              />
            </Card>
          )}
        </>
      )}
    </div>
  )
}
