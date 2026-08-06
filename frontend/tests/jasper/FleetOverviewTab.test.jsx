jest.mock('@/context/ToastContext', () => ({ useToast: () => ({ error: jest.fn(), success: jest.fn() }) }))
jest.mock('@/api/fieldOps', () => ({
  getFleetOverview: jest.fn(),
  getCycleTime: jest.fn(),
  getXeroHealth: jest.fn(),
  getRevenueTrend: jest.fn(),
  getTopClients: jest.fn(),
}))

const React = require('react')
const { render, screen } = require('@testing-library/react')
const {
  getFleetOverview, getCycleTime, getXeroHealth, getRevenueTrend, getTopClients,
} = require('@/api/fieldOps')
const FleetOverviewTab = require('../../src/pages/dashboard/FleetOverviewTab').default

function baseFleetOverview() {
  return {
    data: { data: {
      period: { from: '2026-08-01', to: '2026-08-06' },
      totals: { bookings_total: 10, active_jobs: 2, pending_memo_submission: 0, invoices_synced_to_xero: 8 },
      booking_status_breakdown: [{ status: 'completed', count: 10 }],
      revenue_risk: { completed_without_memo: 0, warning: false },
    } },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  getFleetOverview.mockResolvedValue(baseFleetOverview())
  getCycleTime.mockResolvedValue({ data: { data: { overall_average_days: 2.5, stage_averages_days: {}, rows: [] } } })
  getXeroHealth.mockResolvedValue({ data: { data: {
    counts: { synced: 8, pending: 1, failed: 0 }, last_synced_at: '2026-08-05T00:00:00.000Z',
    mode: { simulated: true, label: 'SIMULATION', detail: 'Xero calls are simulated.' },
  } } })
  getRevenueTrend.mockResolvedValue({ data: { data: { granularity: 'month', trend: [{ bucket: '2026-07', total_revenue: '1000.00' }, { bucket: '2026-08', total_revenue: '1500.00' }] } } })
  getTopClients.mockResolvedValue({ data: { data: { top_clients: [{ client_id: 1, client_name: 'TTSH', total_revenue: '1500.00', invoice_count: 3, booking_count: 4 }] } } })
})

test('renders the average billing cycle KPI, Xero sync health, and top clients once loaded', async () => {
  render(React.createElement(FleetOverviewTab))

  expect(await screen.findByText('Average Billing Cycle')).toBeInTheDocument();
  expect(screen.getByText('2.5 days')).toBeInTheDocument();

  expect(screen.getByText('Xero Sync Health')).toBeInTheDocument();
  expect(screen.getByText('SIMULATION')).toBeInTheDocument();

  expect(screen.getByText('Top Clients')).toBeInTheDocument();
  expect(screen.getByText('TTSH')).toBeInTheDocument();
});
