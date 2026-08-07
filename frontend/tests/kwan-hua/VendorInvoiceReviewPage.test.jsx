import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import VendorInvoiceReviewPage from '@/pages/vendor/VendorInvoiceReviewPage'

function invoice(overrides = {}) {
  return {
    id: 12,
    vendor_name: 'Medical Supplier Pte Ltd',
    invoice_number: 'MS-100',
    invoice_date: '2026-07-01',
    due_date: '2026-07-31',
    pdf_url: 'https://example.com/invoice.pdf',
    currency_code: 'SGD',
    supplier_gst_registration_no: 'M2-1234567-8',
    gst_treatment: 'standard_rated',
    gst_rate_percent: 9,
    xero_tax_type: 'INPUTY24',
    xero_account_code: '400',
    subtotal_excluding_gst: 100,
    gst_amount: 9,
    total_including_gst: 109,
    extracted_total: 109,
    rebate_percentage: 1,
    rebate_amount: 1.09,
    verified_total: 107.91,
    extraction_confidence: 0.95,
    is_low_confidence: false,
    status: 'pending_review',
    items: [{ id: 1, description: 'Medical supplies', quantity: 2, unit_price: 50, amount: 100 }],
    approval_validation: { can_approve: true, issues: [], requires_low_confidence_confirmation: false },
    audit_trail: [{
      id: 1,
      action: 'header_updated',
      changes: { due_date: { from: null, to: '2026-07-31' } },
      note: null,
      actor: { id: 3, name: 'Chloe Lim' },
      created_at: '2026-07-02T10:00:00.000Z',
    }],
    ...overrides,
  }
}

let mock

beforeEach(() => { mock = new MockAdapter(api) })
afterEach(() => mock.reset())

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/vendor-invoices/12']}>
        <Routes>
          <Route path="/vendor-invoices/:id" element={<VendorInvoiceReviewPage />} />
          <Route path="/vendor-invoices" element={<div>Vendor list</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

test('shows AP GST, due-date, coding and audit information', async () => {
  mock.onGet('/vendor-invoices/12').reply(200, { success: true, data: invoice() })
  renderPage()

  expect(await screen.findByRole('heading', { name: 'Medical Supplier Pte Ltd' })).toBeInTheDocument()
  expect(screen.getByDisplayValue('2026-07-31')).toBeInTheDocument()
  expect(screen.queryByDisplayValue('INPUTY24')).not.toBeInTheDocument() // tax type is derived, not editable
  expect(screen.getByText('INPUTY24')).toBeInTheDocument()
  expect(screen.getByText('Audit Timeline')).toBeInTheDocument()
  expect(screen.getByText('header updated')).toBeInTheDocument()
  expect(screen.getByText('Chloe Lim')).toBeInTheDocument()
})

test('requires explicit source verification before approving low-confidence OCR', async () => {
  const user = userEvent.setup()
  const lowConfidence = invoice({
    extraction_confidence: 0.5,
    is_low_confidence: true,
    approval_validation: { can_approve: true, issues: [], requires_low_confidence_confirmation: true },
  })
  mock.onGet('/vendor-invoices/12').reply(200, { success: true, data: lowConfidence })
  mock.onPost('/vendor-invoices/12/approve').reply(200, {
    success: true,
    data: { id: 12, status: 'synced_to_xero', xero_bill_id: 'bill-1', sync_log: { status: 'success' } },
  })
  renderPage()

  const approve = await screen.findByRole('button', { name: /Approve & Sync/i })
  expect(approve).toBeDisabled()
  await user.click(screen.getByLabelText(/I checked this invoice against the source document/i))
  expect(approve).toBeEnabled()
  await user.click(approve)

  await waitFor(() => expect(mock.history.post).toHaveLength(1))
  expect(JSON.parse(mock.history.post[0].data)).toEqual({ confirm_low_confidence: true })
})

test('shows each server-supplied approval issue and disables approval', async () => {
  mock.onGet('/vendor-invoices/12').reply(200, {
    success: true,
    data: invoice({
      approval_validation: {
        can_approve: false,
        requires_low_confidence_confirmation: false,
        issues: [{ code: 'MISSING_XERO_ACCOUNT_CODE', message: 'Xero expense account code is required.' }],
      },
    }),
  })
  renderPage()

  expect(await screen.findByText('Approval is blocked')).toBeInTheDocument()
  expect(screen.getByText('Xero expense account code is required.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Approve & Sync/i })).toBeDisabled()
})

test('manually adds a line to recover an OCR-failed invoice', async () => {
  const user = userEvent.setup()
  const failedInvoice = invoice({
    status: 'extraction_failed',
    items: [],
    extracted_total: null,
    total_including_gst: null,
    approval_validation: { can_approve: false, issues: [], requires_low_confidence_confirmation: false },
  })
  const recoveredInvoice = invoice({
    status: 'pending_review',
    items: [{ id: 9, description: 'Ambulance transport', quantity: 1, unit_price: 250, amount: 250 }],
    subtotal_excluding_gst: 250,
    gst_amount: 22.5,
    total_including_gst: 272.5,
    extracted_total: 272.5,
  })
  mock.onGet('/vendor-invoices/12').replyOnce(200, { success: true, data: failedInvoice })
  mock.onGet('/vendor-invoices/12').reply(200, { success: true, data: recoveredInvoice })
  mock.onPost('/vendor-invoices/12/items').reply(201, { success: true, data: {} })
  renderPage()

  await user.click(await screen.findByRole('button', { name: /Add Item/i }))
  await user.type(screen.getByLabelText('Line Description'), 'Ambulance transport')
  await user.clear(screen.getByLabelText('Unit Price'))
  await user.type(screen.getByLabelText('Unit Price'), '250')
  await user.click(screen.getByRole('button', { name: 'Add Line' }))

  await waitFor(() => expect(mock.history.post).toHaveLength(1))
  expect(JSON.parse(mock.history.post[0].data)).toEqual({
    description: 'Ambulance transport',
    quantity: '1',
    unit_price: '250',
  })
  expect(await screen.findByText('Ambulance transport')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Approve & Sync/i })).toBeInTheDocument()
})

test('confirms deletion and refreshes the recalculated invoice', async () => {
  const user = userEvent.setup()
  mock.onGet('/vendor-invoices/12').replyOnce(200, { success: true, data: invoice() })
  mock.onGet('/vendor-invoices/12').reply(200, {
    success: true,
    data: invoice({
      items: [],
      subtotal_excluding_gst: 0,
      gst_amount: 0,
      total_including_gst: 0,
      extracted_total: 0,
      rebate_amount: 0,
      verified_total: 0,
      approval_validation: {
        can_approve: false,
        issues: [{ code: 'MISSING_LINE_ITEMS', message: 'At least one line item is required.' }],
        requires_low_confidence_confirmation: false,
      },
    }),
  })
  mock.onDelete('/vendor-invoice-items/1').reply(200, { success: true, data: { id: 1 } })
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Delete Medical supplies' }))
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete line item?')
  await user.click(screen.getByRole('button', { name: 'Delete Item' }))

  await waitFor(() => expect(mock.history.delete).toHaveLength(1))
  expect(await screen.findByText('No line items. Add one manually or retry extraction.')).toBeInTheDocument()
  expect(screen.getByText('At least one line item is required.')).toBeInTheDocument()
})

test('requires confirmation before replacing existing data with a new OCR result', async () => {
  const user = userEvent.setup()
  const failedInvoice = invoice({ status: 'extraction_failed' })
  const reextractedInvoice = invoice({
    vendor_name: 'Recovered Supplier Pte Ltd',
    invoice_number: 'REC-200',
    items: [{ id: 8, description: 'Recovered line', quantity: 1, unit_price: 100, amount: 100 }],
  })
  mock.onGet('/vendor-invoices/12').replyOnce(200, { success: true, data: failedInvoice })
  mock.onGet('/vendor-invoices/12').reply(200, { success: true, data: reextractedInvoice })
  mock.onPost('/vendor-invoices/12/reextract').reply(200, { success: true, data: reextractedInvoice })
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Retry Extraction' }))

  expect(screen.getByRole('alertdialog')).toHaveTextContent('Replace extracted invoice data?')
  expect(screen.getByRole('alertdialog')).toHaveTextContent('replace the current extracted fields and 1 line item')
  expect(mock.history.post).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Replace & Retry' }))

  await waitFor(() => expect(mock.history.post).toHaveLength(1))
  expect(JSON.parse(mock.history.post[0].data)).toEqual({ confirm_replace: true })
  expect(await screen.findByRole('heading', { name: 'Recovered Supplier Pte Ltd' })).toBeInTheDocument()
  expect(screen.getByText('Recovered line')).toBeInTheDocument()
})

test('keeps the current review data visible when a confirmed OCR retry fails', async () => {
  const user = userEvent.setup()
  const failedInvoice = invoice({ status: 'extraction_failed' })
  mock.onGet('/vendor-invoices/12').reply(200, { success: true, data: failedInvoice })
  mock.onPost('/vendor-invoices/12/reextract').reply(502, {
    success: false,
    code: 'OCR_EXTRACTION_FAILED',
    message: 'Re-extraction failed. Your existing invoice fields and line items were kept unchanged.',
  })
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Retry Extraction' }))
  await user.click(screen.getByRole('button', { name: 'Replace & Retry' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('existing invoice fields and line items were kept unchanged')
  expect(screen.getByRole('heading', { name: 'Medical Supplier Pte Ltd' })).toBeInTheDocument()
  expect(screen.getByText('Medical supplies')).toBeInTheDocument()
})
