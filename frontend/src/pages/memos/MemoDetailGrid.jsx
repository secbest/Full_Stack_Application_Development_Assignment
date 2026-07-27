import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getServiceMemo } from '@/api/fieldOps'

/**
 * The expanded detail body for one memo, with its own fetch and loading/error states.
 *
 * Extracted from MemoHistoryPage because that page now has two presentations - a table
 * row on desktop and a card on mobile - and both need this identical block. Keeping it
 * here means the fetch, the three field groups, and the error copy are single-sourced;
 * duplicating them per presentation is how the two would quietly drift apart.
 */
export default function MemoDetailGrid({ memoId }) {
  const [detail, setDetail] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    // Collapsing the row unmounts this mid-flight, so ignore a resolution that lands
    // after unmount rather than setting state on a dead component.
    let active = true
    getServiceMemo(memoId)
      .then(({ data }) => {
        if (!active) return
        setDetail(data.data)
        setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => { active = false }
  }, [memoId])

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading memo details...
      </div>
    )
  }

  if (status === 'error') {
    return <p className="text-sm text-[#EF4444] py-2">Failed to load memo details.</p>
  }

  return (
    // Three side-by-side groups from `lg`; stacked below that. The ISO timestamps in the
    // Job Info column need roughly 200px each, so three columns only fit once the content
    // area clears ~600px - at 768px they wrapped mid-value.
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 py-3 text-sm">
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
  )
}
