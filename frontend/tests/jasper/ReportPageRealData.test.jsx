jest.mock('../../src/api/ar', () => ({ listInvoices: jest.fn() }))
jest.mock('../../src/api/fieldOps', () => ({
  getRevenueByServiceType: jest.fn(),
  getCycleTime: jest.fn(),
  getLeakageHistory: jest.fn(),
  getVendorExpenses: jest.fn(),
}))

const React = require('react')
const { render, screen, waitFor } = require('@testing-library/react')
const userEvent = require('@testing-library/user-event').default
const { listInvoices } = require('../../src/api/ar')
const { getRevenueByServiceType, getCycleTime, getLeakageHistory, getVendorExpenses } = require('../../src/api/fieldOps')
const ReportsScreen = require('../../src/pages/dashboard/ReportPage').default

beforeEach(() => {
  jest.clearAllMocks()
  listInvoices.mockResolvedValue({ data: [] })
  getRevenueByServiceType.mockResolvedValue({ data: { data: { breakdown: [] } } })
  getCycleTime.mockResolvedValue({ data: { data: { overall_average_days: 3.5, stage_averages_days: {}, rows: [{ booking_id: 42, job_completed_at: '2026-06-01T00:00:00.000Z', memo_submitted_at: '2026-06-02T00:00:00.000Z', invoice_approved_at: '2026-06-03T00:00:00.000Z', synced_at: '2026-06-05T00:00:00.000Z', total_days: 4 }] } } })
  getLeakageHistory.mockResolvedValue({ data: { data: { history: [{ month: '2026-06', estimated_leakage: 120.5, affected_invoice_count: 1, rows: [{ invoice_id: 7, booking_reference: 'BKG-007', client_name: 'CGH', created_at: '2026-06-10T00:00:00.000Z', unpriced_count: 2, estimated_amount: 120.5 }] }] } } })
  getVendorExpenses.mockResolvedValue({ data: { data: { summary: { total_expenditure: '500.00', total_rebates_applied: '50.00', net_payable: '450.00' }, by_vendor: [{ vendor_name: 'MedSupply Co', total_expenditure: '500.00', total_rebates: '50.00', net_payable: '450.00', invoice_count: 2 }], monthly_trend: [] } } })
})

test('Billing Cycle tab renders the real overall average and the row from getCycleTime', async () => {
  render(React.createElement(ReportsScreen))
  await userEvent.click(screen.getByRole('button', { name: 'Billing Cycle' }))

  expect(await screen.findByText('3.5 days')).toBeInTheDocument()
  expect(screen.getByText('BKG-42')).toBeInTheDocument()
})

test('Leakage History tab renders the real monthly summary and row from getLeakageHistory', async () => {
  render(React.createElement(ReportsScreen))
  await userEvent.click(screen.getByRole('button', { name: 'Leakage History' }))

  expect(await screen.findByText(/\$120\.50 in estimated leakage across 1 invoice/)).toBeInTheDocument()
  expect(screen.getByText('BKG-007')).toBeInTheDocument()
})

test('Vendor Expenditure tab renders real KPIs and vendor rows instead of the "not yet implemented" placeholder', async () => {
  render(React.createElement(ReportsScreen))
  await userEvent.click(screen.getByRole('button', { name: 'Vendor Expenditure' }))

  expect(screen.queryByText('Vendor Expenditure functionality not yet implemented.')).not.toBeInTheDocument()
  expect(await screen.findByText('MedSupply Co')).toBeInTheDocument()
  // "$500.00" legitimately renders twice here: the KPI card's total_expenditure and the
  // single vendor row's total_expenditure are coincidentally equal in this mock data
  // (there's only one vendor, so the total and its one row match).
  expect(screen.getAllByText('$500.00')).toHaveLength(2)
})

test('Revenue tab shows no illustrative-data note and renders real service-type slices', async () => {
  getRevenueByServiceType.mockResolvedValue({ data: { data: { breakdown: [{ service_type: 'eas', label: 'Emergency Ambulance Services (EAS)', total_revenue: '250.00' }] } } })

  render(React.createElement(ReportsScreen))

  await waitFor(() => expect(getRevenueByServiceType).toHaveBeenCalled())
  expect(screen.queryByText(/Illustrative/)).not.toBeInTheDocument()
  expect(await screen.findByText('Emergency Ambulance Services (EAS)')).toBeInTheDocument()
})
