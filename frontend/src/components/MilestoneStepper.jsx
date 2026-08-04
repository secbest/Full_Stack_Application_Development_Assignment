// Owner: Jasper - Field Ops (client feedback item 1, interim review 17 Jul 2026).
// The live job milestone stepper shown on the My Jobs hero card. Crews tap one big
// button as each stage happens ("as when they reach the point, they probably just
// click a button") and the server timestamps it. Recorded steps show their time,
// the next step is the single tap target, later steps are visible but inert - so
// the crew always sees exactly one thing to do.
import { Check, Circle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const MILESTONE_SEQUENCE = ['activated', 'arrived_at_location', 'en_route', 'arrived_at_destination', 'job_completed']

export const MILESTONE_LABELS = {
  activated: 'Activated',
  arrived_at_location: 'Arrived at Location',
  en_route: 'En Route',
  arrived_at_destination: 'Arrived at Destination',
  job_completed: 'Job Complete',
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })
}

export function MilestoneStepper({ milestones = [], onRecord, busy = false }) {
  const recorded = new Map(milestones.map((m) => [m.milestone_type, m.recorded_at]))
  const nextType = MILESTONE_SEQUENCE.find((t) => !recorded.has(t))

  return (
    <ol className="space-y-2">
      {MILESTONE_SEQUENCE.map((type) => {
        const recordedAt = recorded.get(type)
        const label = MILESTONE_LABELS[type]

        if (recordedAt) {
          return (
            <li key={type} className="flex items-center justify-between gap-3 px-1">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <Check className="w-4 h-4 text-[#22C55E] flex-shrink-0" aria-hidden="true" />
                {label}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{formatTime(recordedAt)}</span>
            </li>
          )
        }

        if (type === nextType) {
          return (
            <li key={type}>
              {/* One full-width ~48px target - tappable with gloves on, same reasoning
                  as the memo wizard's ToggleRow sizing. */}
              <Button className="w-full h-12" disabled={busy} onClick={() => onRecord(type)}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                {label}
              </Button>
            </li>
          )
        }

        return (
          <li key={type} className="flex items-center gap-2 px-1 text-sm text-muted-foreground/60">
            <Circle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {label}
          </li>
        )
      })}
    </ol>
  )
}
