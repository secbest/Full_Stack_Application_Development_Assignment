// Owner: Jasper - Field Ops (client feedback item 1, interim review 17 Jul 2026).
// The live job milestone stepper shown on the My Jobs hero card. Crews tap one big
// button as each stage happens ("as when they reach the point, they probably just
// click a button") and the server timestamps it.
//
// Originally a vertical list (one row per stage), which made the hero card too tall
// on-screen. Rebuilt as a horizontal breadcrumb using the exact circle+connector
// pattern already established by memo-wizard/WizardProgressBar.jsx, so it reads as
// the same design language rather than a second stepper style. A single caption line
// carries the timestamp instead of five - it defaults to the most recently recorded
// stage, and tapping any earlier recorded circle swaps the caption to that stage's
// time, so no data is lost even though only one line is shown at a time.
import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  const [selectedType, setSelectedType] = useState(null)

  const recorded = new Map(milestones.map((m) => [m.milestone_type, m.recorded_at]))
  const nextType = MILESTONE_SEQUENCE.find((t) => !recorded.has(t))
  const lastRecordedType = [...MILESTONE_SEQUENCE].reverse().find((t) => recorded.has(t))
  const captionType = selectedType && recorded.has(selectedType) ? selectedType : lastRecordedType

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {MILESTONE_SEQUENCE.map((type, index) => {
          const isDone = recorded.has(type)
          const isNext = type === nextType
          const circle = (
            <div
              className={cn(
                'w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 flex-shrink-0',
                isDone && 'bg-[#22C55E] border-[#22C55E] text-white',
                isNext && !isDone && 'border-[#1E293B] text-[#1E293B]',
                !isDone && !isNext && 'border-muted text-muted-foreground'
              )}
            >
              {isDone ? <Check className="w-4 h-4" aria-hidden="true" /> : index + 1}
            </div>
          )

          return (
            <div key={type} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                {/* A recorded stage is tappable to bring its own timestamp into the
                    caption below - the only way to see an earlier time once the
                    caption has moved on to a later stage. Future stages are inert:
                    the big action button below is the one tap target for those. */}
                {isDone ? (
                  <button
                    type="button"
                    onClick={() => setSelectedType(type)}
                    aria-label={`${MILESTONE_LABELS[type]} - recorded at ${formatTime(recorded.get(type))}`}
                  >
                    {circle}
                  </button>
                ) : (
                  circle
                )}
                <span
                  className={cn(
                    'hidden md:block text-xs text-center leading-tight max-w-[72px]',
                    isNext ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}
                >
                  {MILESTONE_LABELS[type]}
                </span>
              </div>
              {index < MILESTONE_SEQUENCE.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-1 md:mx-1.5', isDone ? 'bg-[#22C55E]' : 'bg-muted')} />
              )}
            </div>
          )
        })}
      </div>

      {captionType && (
        <p data-testid="milestone-caption" className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium">{MILESTONE_LABELS[captionType]}</span> recorded at {formatTime(recorded.get(captionType))}
        </p>
      )}

      {nextType && (
        <Button data-testid="milestone-next-action" className="w-full h-12" disabled={busy} onClick={() => onRecord(nextType)}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
          {MILESTONE_LABELS[nextType]}
        </Button>
      )}
    </div>
  )
}
