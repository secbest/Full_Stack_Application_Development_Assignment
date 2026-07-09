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
  // AR invoice statuses
  matched: '#3B82F6',
  adjusted: '#F59E0B',
  approved: '#22C55E',
  synced_to_xero: '#22C55E',
  failed: '#EF4444',
  unmatched: '#EF4444',
  // Pricing contracts
  active: '#22C55E',
  expired: '#94A3B8',
  upcoming: '#3B82F6',
  deactivated: '#EF4444',
  // Vendor invoices (AP)
  pending_review: '#F59E0B',
  extraction_failed: '#EF4444',
  rejected: '#EF4444',
  // Xero sync logs
  pending: '#F59E0B',
  success: '#22C55E',
}

const STATUS_LABELS = {
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  invoiced: 'Invoiced',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  returned: 'Returned',
  matched: 'Matched',
  adjusted: 'Adjusted',
  approved: 'Approved',
  synced_to_xero: 'Synced to Xero',
  failed: 'Sync Failed',
  unmatched: 'Unmatched',
  active: 'Active',
  expired: 'Expired',
  upcoming: 'Upcoming',
  deactivated: 'Deactivated',
  pending_review: 'Pending Review',
  extraction_failed: 'Extraction Failed',
  rejected: 'Rejected',
  pending: 'Pending',
  success: 'Success',
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
