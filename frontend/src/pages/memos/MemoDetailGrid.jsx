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
    <>
      {/* AR's correction note, shown only while a correction is actually outstanding
          (the note is cleared on resubmission). This is the whole point of returning a
          memo, so it sits above the field groups rather than inside them. */}
      {detail.ar_note && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-amber-900">Correction requested by AR</p>
          <p className="mt-0.5 text-sm text-amber-900">{detail.ar_note}</p>
          {detail.returned_at && (
            <p className="mt-1 text-xs text-amber-700">Returned {new Date(detail.returned_at).toLocaleString()}</p>
          )}
        </div>
      )}

      {/* Three side-by-side groups from `lg`; stacked below that. The ISO timestamps in the
          Job Info column need roughly 200px each, so three columns only fit once the content
          area clears ~600px - at 768px they wrapped mid-value. */}
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
    </>
  )
}
