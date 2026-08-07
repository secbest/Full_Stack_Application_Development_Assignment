// Owner: Kwan Hua (Wave 3 takeover of the AR stream).
//
// NOTE ON SCOPE: this was requested as a generic "orders" test (POST /api/orders,
// 201/500/400-with-field-errors). There is no Order Management feature or
// POST /api/orders endpoint anywhere in this codebase - EFAR's domains are
// bookings, service memos, invoices, and vendor invoices. The closest real
// equivalent in my own feature area is the "Add Adjustment" form on the Invoice
// Detail page (screen 10): it POSTs to /invoices/:id/line-items, returns 201 on
// success, and is the one create-flow I own that has a happy path, a server-error
// path, and a validation-error path all reachable through the real UI. This file
// tests that flow instead, using the same scenario shape that was asked for:
//   1. Successful create -> 201 -> success toast shown
//   2. Server error -> 500 -> error toast shown
//   3. Validation error -> 400 -> error surfaced on the form
//
// One honest adaptation: this component (like the rest of the app) has no
// per-field inline error UI - every create/update flow in EFAR surfaces errors as
// a toast (role="alert"), per this app's own convention (see CLAUDE.md: "no email
// confirmations - all confirmations use in-app toast notifications"). So
// "verify errors appear on the form" here means "verify the toast alert shows the
// server's validation message next to the still-open Add Adjustment form" - there
// is no separate per-field red-text state to assert on, and pretending there is
// would be testing something that isn't actually built.
//
// See the bottom of this file for how to exercise the same 3 scenarios manually
// against a running dev server (axios-mock-adapter only runs under Jest/Node, not
// in a live browser tab, so the manual recipe uses Chrome DevTools instead).

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import InvoiceDetailPage from '@/pages/invoices/InvoiceDetailPage'

// getInvoice() (frontend/src/api/ar.js) unwraps { success, data } and returns `data`
// directly - this is the shape InvoiceDetailPage renders.
function baseInvoice(overrides = {}) {
  return {
    id: 9,
    client_id: 1,
    booking_reference: 'BK-2026-0142',
    client_name: 'Tan Tock Seng Hospital',
    contract_name: 'TTSH - FY2027',
    memo_id: 55,
    subtotal: '850.00',
    gst_rate_percent: '9.00',
    gst_effective_date: '2026-06-10',
    tax_amount: '76.50',
    total_amount: '926.50',
    status: 'matched',
    xero_invoice_id: null,
    unpriced_surcharges: [],
    line_items: [
      { id: 1, description: 'EAS - Office Hours', quantity: '1', unit_price: '850.00', amount: '850.00', is_manual_adjustment: false },
    ],
    ...overrides,
  }
}

describe('InvoiceDetailPage - retry automatic matching', () => {
  test('explains unpriced charges clearly when no active contract exists', async () => {
    mock.onGet('/invoices/9').reply(200, {
      success: true,
      data: baseInvoice({
        status: 'unmatched',
        contract_name: null,
        subtotal: '0.00',
        total_amount: '0.00',
        line_items: [],
        unpriced_surcharges: [
          { surcharge_type: 'oxygen_base', label: 'Oxygen (base)', detail: '2L used' },
          { surcharge_type: 'disposables_base', label: 'Disposables', detail: 'recorded on memo' },
        ],
      }),
    })

    renderDetail()

    expect(await screen.findByText('2 recorded charges awaiting pricing')).toBeInTheDocument()
    expect(screen.getByText(/no active contract was available to price them/i)).toBeInTheDocument()
    expect(screen.queryByText(/no active contract has no rate/i)).not.toBeInTheDocument()
  })

  test('retries an unmatched invoice and renders the contract-priced result', async () => {
    const user = userEvent.setup()
    const unmatched = baseInvoice({
      status: 'unmatched', contract_name: null, subtotal: '0.00', total_amount: '0.00', line_items: [],
    })
    mock.onGet('/invoices/9').replyOnce(200, { success: true, data: unmatched })
    mock.onPost('/invoices/9/rematch').reply(200, {
      success: true,
      data: { invoice_id: 9, status: 'matched', contract_id: 4, subtotal: 1200, total_amount: 1200, warning: null },
    })
    mock.onGet('/invoices/9').reply(200, {
      success: true,
      data: baseInvoice({
        status: 'matched', contract_name: 'TTSH - FY2027', subtotal: '1200.00', total_amount: '1200.00',
        line_items: [{ id: 3, description: 'EAS - Two-Way Hospital', quantity: '1', unit_price: '1200.00', amount: '1200.00', is_manual_adjustment: false }],
      }),
    })

    renderDetail()
    await screen.findByRole('heading', { name: 'Invoice #9' })
    expect(screen.getByText(/No active pricing contract covers this service/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Retry Match/i }))

    expect(await screen.findByText('EAS - Two-Way Hospital')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Invoice matched successfully')
    expect(mock.history.post).toHaveLength(1)
    expect(mock.history.post[0].url).toBe('/invoices/9/rematch')
  })

  test('shows the exact missing rate combination and links to the active contract', async () => {
    mock.onGet('/invoices/9').reply(200, {
      success: true,
      data: baseInvoice({
        status: 'unmatched', contract_id: 7, contract_name: 'TTSH - FY2027',
        subtotal: '0.00', total_amount: '0.00', line_items: [],
        matching_requirements: {
          reason: 'missing_rate', service_date: '2026-08-01', service_type: 'eas',
          transfer_type: 'two_way_hospital', time_of_day: 'office_hours',
        },
      }),
    })

    renderDetail()

    expect(await screen.findByText('The active contract is missing this rate')).toBeInTheDocument()
    expect(screen.getByText(/Required:/i)).toHaveTextContent('EAS / Two-Way Hospital / Office Hours for service date 2026-08-01')
    expect(screen.getByRole('button', { name: 'Open Contract Rates' })).toBeInTheDocument()
  })

  test('explains a quotation mismatch and offers manual pricing instead of a new contract', async () => {
    mock.onGet('/invoices/9').reply(200, {
      success: true,
      data: baseInvoice({
        status: 'unmatched', contract_id: null, contract_name: null,
        pricing_source: 'one_off_quote', quoted_base_amount: '725.50',
        subtotal: '0.00', total_amount: '0.00', line_items: [],
        matching_requirements: {
          reason: 'quote_mismatch', service_date: '2026-08-01',
          quoted_service_type: 'eas', quoted_transfer_type: 'one_way_hospital', quoted_time_of_day: 'office_hours',
          service_type: 'eas', transfer_type: 'two_way_hospital', time_of_day: 'office_hours',
        },
      }),
    })

    renderDetail()

    expect(await screen.findByText('Completed service differs from the approved quotation')).toBeInTheDocument()
    expect(screen.getByText(/Quoted:/i)).toHaveTextContent('Quoted: EAS / One-Way Hospital / Office Hours')
    expect(screen.getByRole('button', { name: 'Price Manually' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create Pricing Contract' })).not.toBeInTheDocument()
    expect(screen.getByText('One-off quotation')).toBeInTheDocument()
    expect(screen.getByText('$725.50')).toBeInTheDocument()
  })

  test('uses the proper Xero product name in the locked invoice message', async () => {
    mock.onGet('/invoices/9').reply(200, {
      success: true,
      data: baseInvoice({ status: 'synced_to_xero', xero_invoice_id: 'xero-invoice-9' }),
    })

    renderDetail()

    expect(await screen.findByText('This invoice has been synced to Xero - line items are locked.')).toBeInTheDocument()
    expect(screen.getByText('GST (9%)')).toBeInTheDocument()
  })
})

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
})

afterEach(() => {
  mock.reset()
})

function renderDetail(invoiceId = 9) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/invoices/${invoiceId}`]}>
        <Routes>
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/invoices" element={<div>Invoice List Stub</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

// Opens the "Add Adjustment" panel and fills in client-side-valid values, so the
// component's own guard (handleAdd's `!description.trim() || !(qty > 0) || !(price > 0)`
// check) lets the request through to the mocked API instead of blocking it locally -
// exactly what all three scenarios below need, since each one is testing how the UI
// reacts to the *server's* response, not the client-side guard.
async function fillAndSubmitAdjustment(user, { description = 'Extra mileage surcharge', quantity = '1', unitPrice = '40' } = {}) {
  await user.click(screen.getByRole('button', { name: /Add Adjustment/i }))
  await user.type(screen.getByLabelText('Description'), description)
  const qtyInput = screen.getByLabelText('Qty')
  await user.clear(qtyInput)
  await user.type(qtyInput, quantity)
  const priceInput = screen.getByLabelText('Unit Price')
  await user.type(priceInput, unitPrice)
  await user.click(screen.getByRole('button', { name: 'Add' }))
}

describe('InvoiceDetailPage - add line item (POST /invoices/:id/line-items)', () => {
  test('successful create: mocking 201 shows a success toast and the new line item', async () => {
    const user = userEvent.setup()
    mock.onGet('/invoices/9').reply(200, { success: true, data: baseInvoice() })

    renderDetail()
    await screen.findByRole('heading', { name: 'Invoice #9' })

    mock.onPost('/invoices/9/line-items').reply(201, {
      success: true,
      data: { id: 2, invoice_id: 9, description: 'Extra mileage surcharge', quantity: 1, unit_price: 40, amount: 40, is_manual_adjustment: true },
      invoice: { id: 9, subtotal: 890, total_amount: 890, status: 'adjusted' },
    })
    // The component reloads the invoice after a successful add - the mocked reload
    // reflects the new manual line item so we can assert it actually renders.
    mock.onGet('/invoices/9').reply(200, {
      success: true,
      data: baseInvoice({
        subtotal: '890.00', total_amount: '890.00', status: 'adjusted',
        line_items: [
          ...baseInvoice().line_items,
          { id: 2, description: 'Extra mileage surcharge', quantity: '1', unit_price: '40.00', amount: '40.00', is_manual_adjustment: true },
        ],
      }),
    })

    await fillAndSubmitAdjustment(user)

    const successToast = await screen.findByRole('alert')
    expect(successToast).toHaveTextContent('Manual adjustment added.')
    expect(successToast.className).toMatch(/border-\[#22C55E\]/) // green success border, per ToastContext

    expect(await screen.findByText('Extra mileage surcharge')).toBeInTheDocument()
    expect(mock.history.post).toHaveLength(1)
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      description: 'Extra mileage surcharge', quantity: 1, unit_price: 40,
    })
  })

  test('server error: mocking 500 with no body falls back to a generic error toast', async () => {
    const user = userEvent.setup()
    mock.onGet('/invoices/9').reply(200, { success: true, data: baseInvoice() })

    renderDetail()
    await screen.findByRole('heading', { name: 'Invoice #9' })

    // No response body at all - proves handleAdd's `err.response?.data?.message || '...'`
    // fallback actually kicks in, not just the happy case where the server helpfully
    // supplies a message.
    mock.onPost('/invoices/9/line-items').reply(500)

    await fillAndSubmitAdjustment(user)

    const errorToast = await screen.findByRole('alert')
    expect(errorToast).toHaveTextContent('Failed to add line item.')
    expect(errorToast.className).toMatch(/border-\[#EF4444\]/) // red error border, per ToastContext

    // Nothing was added - the table still only shows the original engine-generated row.
    expect(screen.queryByText('Extra mileage surcharge')).not.toBeInTheDocument()
    expect(screen.getByText('EAS - Office Hours')).toBeInTheDocument()
  })

  test('validation error: mocking 400 shows the backend\'s validation message as a toast', async () => {
    const user = userEvent.setup()
    mock.onGet('/invoices/9').reply(200, { success: true, data: baseInvoice() })

    renderDetail()
    await screen.findByRole('heading', { name: 'Invoice #9' })

    mock.onPost('/invoices/9/line-items').reply(400, {
      success: false,
      code: 'VALIDATION_ERROR',
      message: '`description` is required and `quantity`/`unit_price` must be positive numbers.',
    })

    await fillAndSubmitAdjustment(user)

    // This IS "the error appearing on the form" for this app: the Add Adjustment
    // panel stays open (no navigation, no reset) with the toast naming exactly what
    // the backend rejected, right next to the still-filled-in fields.
    const errorToast = await screen.findByRole('alert')
    expect(errorToast).toHaveTextContent('`description` is required and `quantity`/`unit_price` must be positive numbers.')
    expect(errorToast.className).toMatch(/border-\[#EF4444\]/)

    expect(screen.getByDisplayValue('Extra mileage surcharge')).toBeInTheDocument()
    expect(mock.history.post).toHaveLength(1)
  })
})

/*
 * ── Manually exercising the same 3 scenarios in a real browser ─────────────────
 *
 * axios-mock-adapter (used above) only works inside Jest/Node - it wraps the
 * `api` axios instance's adapter function directly, which isn't something you can
 * reach from a live browser tab's console without editing the app's source. To
 * see the SAME three UI reactions in an actual running app (frontend `npm run dev`
 * + backend `node src/index.js`), use Chrome DevTools instead:
 *
 * 1. Open the Invoice Detail page for any invoice, open DevTools -> Network tab.
 *
 * 2. SUCCESSFUL CREATE (201):
 *    Just use the form normally - fill in Description/Qty/Unit Price on a real
 *    invoice and click Add. Watch the Network tab: the POST to
 *    /api/invoices/:id/line-items should show status 201, and you should see the
 *    green toast "Manual adjustment added." appear bottom-right for ~3s.
 *
 * 3. SERVER ERROR (500):
 *    DevTools -> Network tab -> right-click the POST request -> "Block request URL"
 *    (or stop the backend process entirely, e.g. Ctrl+C the `node src/index.js`
 *    terminal) before clicking Add. The request will fail, and you should see the
 *    red toast "Failed to add line item." appear. Un-block the URL / restart the
 *    backend afterwards.
 *
 * 4. VALIDATION ERROR (400):
 *    No network trick needed - this one's a real code path. Open Add Adjustment
 *    and try to submit invalid values (e.g. leave Description blank, or type "-5"
 *    into Unit Price). The component's own client-side guard already catches this
 *    before any request goes out, showing the red toast "Enter a description and
 *    positive quantity and unit price." To see the *server's* 400 response
 *    specifically (VALIDATION_ERROR), use DevTools' Network tab -> "..." menu ->
 *    "Override content" on the POST response (Chrome's Local Overrides feature)
 *    to force a 400 body of your choosing, then submit client-side-valid values -
 *    the same red toast pattern will render with whatever message you put in the
 *    overridden response body.
 *
 * In all three cases, verifying "the UI responds correctly" means: the toast
 * matching the outcome appears bottom-right within ~1s, it auto-dismisses after
 * 3s, and on failure the Add Adjustment panel and its typed-in values remain on
 * screen so nothing is lost and the user can just fix the input and retry.
 */
