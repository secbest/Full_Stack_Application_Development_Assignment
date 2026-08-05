// Owner: Kwan Hua.
//
// Regression coverage for the Revenue Leakage report screen, written after it shipped as a
// white screen. The cause was in the API module, not the component: the shared axios
// interceptor in src/api/index.js passes the FULL response through (it only handles 401
// redirects), so every api module unwraps `res.data.data` itself. api/leakage.js returned
// the raw axios response, so the page read `summary` off an axios object, got undefined,
// and threw on the first field access - blanking the entire route.
//
// These tests mock the axios instance rather than the api module, so they run through the
// real unwrapping code. Mocking '@/api/leakage' would have passed against the broken build.
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import RevenueLeakagePage from '@/pages/dashboard/RevenueLeakagePage'
import { getRevenueLeakage } from '@/api/leakage'

let mock

beforeEach(() => { mock = new MockAdapter(api) })
afterEach(() => { mock.restore() })

// Mirrors the real payload from GET /api/dashboard/revenue-leakage, including the envelope
// the endpoint actually sends: { success, data: {...} }.
function reportEnvelope(overrides = {}) {
  return {
    success: true,
    data: {
      period: { from: '2026-01-01', to: '2026-08-05' },
      summary: {
        estimated_leakage: 909,
        affected_invoice_count: 3,
        unpriced_item_count: 6,
        items_without_reference_rate: 0,
        items_without_recorded_quantity: 1,
        top_recommendation: 'Sembawang Marine 2026 is missing 3 surcharge rate(s), accounting for an estimated $909.00 of unbilled charges across 3 invoice(s).',
      },
      by_surcharge_type: [
        { surcharge_type: 'overtime_per_hour', label: 'Overtime', occurrences: 3, total_quantity: 18, unit_rate: 45, basis: 'contract_peer_median', estimated_amount: 810 },
        { surcharge_type: 'suction', label: 'Suction', occurrences: 1, total_quantity: 1, unit_rate: null, basis: 'no_reference_rate', estimated_amount: 0 },
      ],
      by_contract: [
        { contract_id: 2, contract_name: 'Sembawang Marine 2026', client_id: 8, client_name: 'Sembawang Marine Services', affected_invoices: 3, missing_surcharge_types: ['overtime_per_hour', 'oxygen_per_litre', 'waiting_time_per_30min'], estimated_amount: 909 },
      ],
      affected_invoices: [
        { invoice_id: 8, client_id: 8, client_name: 'Sembawang Marine Services', contract_id: 2, created_at: '2026-08-05T00:00:00.000Z', unpriced_count: 2, estimated_amount: 406 },
      ],
      reference_rates: { overtime_per_hour: { median: 45, sampleSize: 1, min: 45, max: 45 } },
      basis_note: 'Amounts are estimates.',
      ...overrides,
    },
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <RevenueLeakagePage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('getRevenueLeakage - unwrapping', () => {
  // The actual defect. The shared interceptor does not unwrap, so this must.
  test('returns the report itself, not the axios response', async () => {
    mock.onGet(/\/dashboard\/revenue-leakage/).reply(200, reportEnvelope())
    const report = await getRevenueLeakage({ date_from: '2026-01-01', date_to: '2026-08-05' })

    expect(report.summary).toBeDefined()
    expect(report.summary.estimated_leakage).toBe(909)
    // Guards against regressing to `return api.get(...)`, whose result carries these.
    expect(report.status).toBeUndefined()
    expect(report.config).toBeUndefined()
  })

  test('passes the date range through as query params', async () => {
    mock.onGet(/\/dashboard\/revenue-leakage/).reply(200, reportEnvelope())
    await getRevenueLeakage({ date_from: '2026-01-01', date_to: '2026-08-05' })
    expect(mock.history.get[0].params).toEqual({ date_from: '2026-01-01', date_to: '2026-08-05' })
  })
})

describe('RevenueLeakagePage', () => {
  test('renders the summary, breakdowns and recommendation', async () => {
    mock.onGet(/\/dashboard\/revenue-leakage/).reply(200, reportEnvelope())
    renderPage()

    expect(await screen.findByText(/Fix this first/i)).toBeInTheDocument()
    expect(screen.getByText(/is missing 3 surcharge rate\(s\)/i)).toBeInTheDocument()

    // $909.00 legitimately appears twice: the headline stat card and the contract row.
    expect(screen.getAllByText('$909.00')).toHaveLength(2)

    // Breakdowns
    expect(screen.getByText('Overtime')).toBeInTheDocument()
    expect(screen.getByText('$810.00')).toBeInTheDocument()
    expect(screen.getByText('Sembawang Marine 2026')).toBeInTheDocument()
    expect(screen.getByText('#8')).toBeInTheDocument()

    // The estimate basis must be visible, not buried in the payload.
    expect(screen.getByText(/Amounts are estimates/i)).toBeInTheDocument()
  })

  test('labels a surcharge with no reference rate instead of showing a misleading $0.00 rate', async () => {
    mock.onGet(/\/dashboard\/revenue-leakage/).reply(200, reportEnvelope())
    renderPage()
    await screen.findByText(/Fix this first/i)

    // Case-sensitive on purpose: the stat card label is "No reference rate" (uppercased in
    // CSS only), so a case-insensitive match would hit both it and this table cell.
    expect(screen.getByText('no reference rate')).toBeInTheDocument()
  })

  test('shows the honesty counters', async () => {
    mock.onGet(/\/dashboard\/revenue-leakage/).reply(200, reportEnvelope())
    renderPage()
    await screen.findByText(/Fix this first/i)
    expect(screen.getByText(/Counted but cannot be valued/i)).toBeInTheDocument()
    expect(screen.getByText(/understates leakage/i)).toBeInTheDocument()
  })

  test('reports a clean period rather than an empty screen when nothing is unpriced', async () => {
    mock.onGet(/\/dashboard\/revenue-leakage/).reply(200, reportEnvelope({
      summary: {
        estimated_leakage: 0,
        affected_invoice_count: 0,
        unpriced_item_count: 0,
        items_without_reference_rate: 0,
        items_without_recorded_quantity: 0,
        top_recommendation: 'No unpriced surcharges were recorded in this period.',
      },
      by_surcharge_type: [],
      by_contract: [],
      affected_invoices: [],
    }))
    renderPage()

    expect(await screen.findByText(/every charge the crew logged was priced/i)).toBeInTheDocument()
    expect(screen.queryByText(/Fix this first/i)).not.toBeInTheDocument()
  })

  // The white screen itself: a payload the component's field reads cannot survive must
  // produce an error state, never a blank route.
  test('shows a recoverable error instead of blanking on a malformed payload', async () => {
    mock.onGet(/\/dashboard\/revenue-leakage/).reply(200, { success: true, data: { nonsense: true } })
    renderPage()

    expect(await screen.findByText(/Could not load the report/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })

  test('shows a recoverable error when the request fails', async () => {
    mock.onGet(/\/dashboard\/revenue-leakage/).reply(500, { success: false, message: 'Database unavailable' })
    renderPage()

    expect(await screen.findByText(/Could not load the report/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Database unavailable/i))
  })
})
