import { cn } from '@/lib/utils'

const STEPS = ['Job Details', 'Service & Charges', 'Signature', 'Stamp & Submit']

export default function WizardProgressBar({ currentStep }) {
  const currentLabel = STEPS[currentStep - 1]

  return (
    <div className="space-y-2">
      {/* Four labels under the circles need ~85px each - they do not fit a 343px phone
          without wrapping into an unreadable stack. Below `md` the per-step captions are
          dropped and the current step is named once, here, so the crew still knows where
          they are in the memo. From `md` up this line is redundant and hidden. */}
      <p className="text-xs font-medium text-muted-foreground md:hidden">
        Step {currentStep} of {STEPS.length} - <span className="text-foreground">{currentLabel}</span>
      </p>

      <div className="flex items-center">
        {STEPS.map((label, index) => {
          const stepNumber = index + 1
          const isDone = stepNumber < currentStep
          const isActive = stepNumber === currentStep
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 flex-shrink-0',
                    isDone && 'bg-[#22C55E] border-[#22C55E] text-white',
                    isActive && !isDone && 'border-[#1E293B] text-[#1E293B]',
                    !isDone && !isActive && 'border-muted text-muted-foreground'
                  )}
                >
                  {isDone ? '✓' : stepNumber}
                </div>
                <span
                  className={cn(
                    'hidden md:block text-xs text-center',
                    isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </div>
              {stepNumber < STEPS.length && (
                <div className={cn('flex-1 h-0.5 mx-1.5 md:mx-2', isDone ? 'bg-[#22C55E]' : 'bg-muted')} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
