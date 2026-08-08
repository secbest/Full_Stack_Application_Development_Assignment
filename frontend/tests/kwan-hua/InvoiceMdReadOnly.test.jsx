// Owner: Kwan Hua - the Managing Director's read-only view of AR invoices.
//
// The Revenue Leakage report is deliberately shared between the MD and the AR Specialist
// (dashboardRoutes.js says so explicitly: the MD reads the number, Sarah fixes the
// contract behind it). RevenueLeakagePage links each leakage row straight to
// /invoices/:id, but that route was gated to ar_specialist only - so Doris clicked a
// leakage row and got the Forbidden page. The backend had always allowed her the GET.
//
// Opening the route is only half the fix: the page had no role awareness at all, so the
// naive version showed her Approve & Sync / Retry Match / Add Adjustment / delete
// controls that every one of which 403s on the backend. These tests pin BOTH halves -
// the MD can read the figures, and cannot see a control she is not allowed to use.
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import InvoiceDetailPage from '@/pages/invoices/InvoiceDetailPage'
import InvoiceListPage from '@/pages/invoices/InvoiceListPage'

jest.mock('@/hooks', () => ({
  useAuth: () => ({ user: { id: 1, role: 'managing_director' } }),
}))

const INVOICE = {
  id: 20,
  client_id: 18,
  booking_reference: 'BKG-2026-00021',
  client_name: 'NUS Nursing',
  contract_name: null,
  contract_id: null,
  memo_id: 32,
  subtotal: '20.00',
  gst_rate_percent: '9.00',
  gst_effective_date: '2026-08-08',
  tax_amount: '1.80',
  total_amount: '21.80',
  status: 'matched', // a status that WOULD render Approve & Sync for an AR user
  xero_invoice_id: null,
  unpriced_surcharges: [
    { label: 'Resuscitation', detail: 'performed', quantity: 1, surcharge_type: 'resuscitation' },
  ],
  line_items: [
    { id: 1, description: 'Base transport', line_type: 'base', quantity: '1.00', unit_price: '20.00', amount: '20.00', is_manual_adjustment: true },
  ],
}

let mock
beforeEach(() => { mock = new MockAdapter(api) })
afterEach(() => mock.restore())

function renderDetail() {
  mock.onGet('/invoices/20').reply(200, { success: true, data: INVOICE })
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/invoices/20']}>
        <Routes><Route path="/invoices/:id" element={<InvoiceDetailPage />} /></Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('Invoice Detail - Managing Director', () => {
  // The client name renders twice (page subtitle and the details panel), so these queries
  // use findAllByText deliberately rather than asserting on a single node.
  const loaded = () => screen.findAllByText(/NUS Nursing/)

  test('can read the invoice figures', async () => {
    renderDetail()
    expect((await loaded()).length).toBeGreaterThan(0)
    expect(screen.getByText('$21.80')).toBeInTheDocument()
  })

  test('is told the screen is read-only', async () => {
    renderDetail()
    expect(await screen.findByText('View only')).toBeInTheDocument()
  })

  test('sees no AR write controls, even on a status that would show them to AR', async () => {
    renderDetail()
    await loaded()

    // status is 'matched', which renders Approve & Sync for an ar_specialist.
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add adjustment/i })).not.toBeInTheDocument()
  })

  test('the back link returns to Revenue Leakage, not the AR queue she cannot open', async () => {
    renderDetail()
    expect(await screen.findByRole('button', { name: /back to revenue leakage/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back to invoices/i })).not.toBeInTheDocument()
  })
})

describe('Invoice List - Managing Director', () => {
  test('can read the queue but cannot select or batch approve', async () => {
    // listInvoices() unwraps res.data.data, so the list lives one level deeper than the
    // detail endpoint's payload - see frontend/src/api/ar.js.
    mock.onGet('/invoices').reply(200, { success: true, data: { data: [INVOICE], meta: { total: 1 } } })
    render(
      <ToastProvider>
        <MemoryRouter><InvoiceListPage /></MemoryRouter>
      </ToastProvider>
    )

    expect(await screen.findByText('NUS Nursing')).toBeInTheDocument()
    expect(screen.getByText('View only')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /batch approve/i })).not.toBeInTheDocument()
    // No selection affordance at all - a checkbox that leads to a 403 is worse than none.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })
})
