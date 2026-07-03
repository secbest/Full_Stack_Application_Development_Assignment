import { cn } from '@/lib/utils'

const STEPS = ['Job Details', 'Service & Charges', 'Signature', 'Stamp & Submit']

export default function WizardProgressBar({ currentStep }) {
  return (
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
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2',
                  isDone && 'bg-[#22C55E] border-[#22C55E] text-white',
                  isActive && !isDone && 'border-[#1E293B] text-[#1E293B]',
                  !isDone && !isActive && 'border-muted text-muted-foreground'
                )}
              >
                {isDone ? '✓' : stepNumber}
              </div>
              <span className={cn('text-xs', isActive ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                {label}
              </span>
            </div>
            {stepNumber < STEPS.length && (
              <div className={cn('flex-1 h-0.5 mx-2', isDone ? 'bg-[#22C55E]' : 'bg-muted')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
