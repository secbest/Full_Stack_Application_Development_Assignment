// Owner: Kwan Hua - the Dismiss action that closes a revenue-leakage row.
//
// The report used to only accumulate: a gap that had genuinely been dealt with (billed
// separately, or written off because the invoice was already issued through Xero and
// cannot be silently re-priced) had no way to leave the total, so the figure drifted from
// reality and the report became easy to ignore.
//
// Like RevenueLeakagePage.test.jsx, these mock the axios instance rather than '@/api/leakage',
// so the real request/unwrapping code runs - mocking the api module would pass against a
// broken client.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import RevenueLeakagePage from '@/pages/dashboard/RevenueLeakagePage'

let mock
beforeEach(() => { mock = new MockAdapter(api) })
afterEach(() => { mock.restore() })

const OPEN_ROW = { invoice_id: 20, client_id: 18, client_name: 'NUS Nursing', contract_id: null, created_at: '2026-08-07T16:41:56Z', unpriced_count: 3, estimated_amount: 390 }

function envelope({ open = [OPEN_ROW], dismissed = { count: 0, estimated_amount: 0, rows: [] } } = {}) {
  const total = open.reduce((sum, r) => sum + r.estimated_amount, 0)
  return {
    success: true,
    data: {
      period: { from: '2026-01-01', to: '2026-08-08' },
      summary: {
        estimated_leakage: total,
        affected_invoice_count: open.length,
        unpriced_item_count: open.reduce((s, r) => s + r.unpriced_count, 0),
        items_without_reference_rate: 0,
        items_without_recorded_quantity: 0,
        top_recommendation: 'No active contract is missing 3 surcharge rate(s).',
      },
      by_surcharge_type: [],
      by_contract: [],
      affected_invoices: open,
      dismissed,
      basis_note: 'Amounts are estimates.',
    },
  }
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter><RevenueLeakagePage /></MemoryRouter>
    </ToastProvider>
  )
}

describe('Revenue Leakage - dismissing a row', () => {
  test('requires a reason before the write-off can be confirmed', async () => {
    mock.onGet('/dashboard/revenue-leakage').reply(200, envelope())
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /dismiss/i }))

    const confirm = screen.getByRole('button', { name: /dismiss & close/i })
    expect(confirm).toBeDisabled()

    // Too short - a one-word note records the decision without recording why.
    await userEvent.type(screen.getByLabelText(/reason/i), 'ok')
    expect(confirm).toBeDisabled()

    await userEvent.clear(screen.getByLabelText(/reason/i))
    await userEvent.type(screen.getByLabelText(/reason/i), 'Billed separately on INV-204.')
    expect(confirm).toBeEnabled()
  })

  test('sends the reason to the dismiss endpoint and reloads the report', async () => {
    mock.onGet('/dashboard/revenue-leakage').reply(200, envelope())
    mock.onPatch('/dashboard/revenue-leakage/20/dismiss').reply(200, { success: true, data: { invoice_id: 20 } })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /dismiss/i }))
    await userEvent.type(screen.getByLabelText(/reason/i), 'Written off - invoice already issued in Xero.')
    await userEvent.click(screen.getByRole('button', { name: /dismiss & close/i }))

    await waitFor(() => expect(mock.history.patch).toHaveLength(1))
    expect(mock.history.patch[0].url).toBe('/dashboard/revenue-leakage/20/dismiss')
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ reason: 'Written off - invoice already issued in Xero.' })
    // Reloaded so the figure on screen reflects the decision immediately.
    await waitFor(() => expect(mock.history.get.length).toBeGreaterThan(1))
  })

  test('surfaces a backend rejection instead of appearing to succeed', async () => {
    mock.onGet('/dashboard/revenue-leakage').reply(200, envelope())
    mock.onPatch('/dashboard/revenue-leakage/20/dismiss').reply(409, {
      success: false, code: 'LEAKAGE_ALREADY_DISMISSED', message: 'This leakage row has already been dismissed.',
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /dismiss/i }))
    await userEvent.type(screen.getByLabelText(/reason/i), 'Attempting to dismiss this a second time.')
    await userEvent.click(screen.getByRole('button', { name: /dismiss & close/i }))

    expect(await screen.findByText(/already been dismissed/i)).toBeInTheDocument()
  })
})

describe('Revenue Leakage - closed rows stay visible and reversible', () => {
  const DISMISSED = {
    count: 1,
    estimated_amount: 390,
    rows: [{
      invoice_id: 20, client_name: 'NUS Nursing', created_at: '2026-08-07T16:41:56Z',
      unpriced_count: 3, estimated_amount: 390,
      dismissed_at: '2026-08-08T10:00:00Z',
      dismissed_reason: 'Written off - invoice already issued in Xero.',
      dismissed_by: { id: 2, name: 'Sarah Lim' },
    }],
  }

  test('a write-off is reported separately, never folded into the open figure', async () => {
    mock.onGet('/dashboard/revenue-leakage').reply(200, envelope({ open: [], dismissed: DISMISSED }))
    renderPage()

    expect(await screen.findByText(/Closed \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/\$390\.00 reviewed and closed/)).toBeInTheDocument()
  })

  test('shows who closed it and why, and can reopen it', async () => {
    mock.onGet('/dashboard/revenue-leakage').reply(200, envelope({ open: [], dismissed: DISMISSED }))
    mock.onDelete('/dashboard/revenue-leakage/20/dismiss').reply(200, { success: true, data: { invoice_id: 20 } })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /^show$/i }))

    expect(screen.getByText('Written off - invoice already issued in Xero.')).toBeInTheDocument()
    expect(screen.getByText('Sarah Lim')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /reopen/i }))
    await waitFor(() => expect(mock.history.delete).toHaveLength(1))
    expect(mock.history.delete[0].url).toBe('/dashboard/revenue-leakage/20/dismiss')
  })

  test('the closed section is absent when nothing has been dismissed', async () => {
    mock.onGet('/dashboard/revenue-leakage').reply(200, envelope())
    renderPage()

    await screen.findByRole('button', { name: /dismiss/i })
    expect(screen.queryByText(/Closed \(/)).not.toBeInTheDocument()
  })
})
