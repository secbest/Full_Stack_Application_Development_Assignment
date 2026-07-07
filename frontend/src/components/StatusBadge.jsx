import { cn } from '@/lib/utils'

// Implements CLAUDE.md's status badge spec directly (pill, 6px radius, 15% opacity
// background with matching text) using the exact design-token hex values, rather than
// shadcn's default Badge variants which are theme-color based and don't match this spec.
const STATUS_COLORS = {
  confirmed: '#3B82F6',
  in_progress: '#F59E0B',
  completed: '#22C55E',
  invoiced: '#94A3B8',
  submitted: '#3B82F6',
  reviewed: '#22C55E',
  returned: '#F59E0B',
}

const STATUS_LABELS = {
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  invoiced: 'Invoiced',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  returned: 'Returned',
}

export function StatusBadge({ status, className }) {
  const color = STATUS_COLORS[status] || '#94A3B8'
  const label = STATUS_LABELS[status] || status

  return (
    <span
      className={cn('inline-flex items-center rounded-[6px] px-2.5 py-0.5 text-xs font-medium', className)}
      style={{ backgroundColor: `${color}26`, color }}
    >
      {label}
    </span>
  )
}
