// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper.
// Invoice List (screen 9): 6-status filter, selection rules, batch approve & sync.
//
// The batch action is the highest-consequence control on the AR side - it approves
// invoices AND pushes them to Xero, which is the point of no return for a document. The
// tests below concentrate on what must never happen: selecting an invoice that is not
// approvable, and reporting a partial Xero failure as a clean success.
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import InvoiceListPage from '@/pages/invoices/InvoiceListPage'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

jest.mock('@/hooks', () => ({
  useAuth: () => ({ user: { id: 2, role: 'ar_specialist' } }),
}))

let mock

// One invoice per status so the filter chips and the selection rules are exercised
// against every state the screen claims to support.
const INVOICES = [
  { id: 1, booking_reference: 'BKG-2026-00001', client_name: 'Tan Tock Seng Hospital', subtotal: 850, tax_amount: 76.5, gst_rate_percent: 9, total_amount: 926.5, status: 'matched', xero_invoice_id: null },
  { id: 2, booking_reference: 'BKG-2026-00002', client_name: 'ABC Corporation', subtotal: 1080, tax_amount: 97.2, gst_rate_percent: 9, total_amount: 1177.2, status: 'adjusted', xero_invoice_id: null },
  { id: 3, booking_reference: 'BKG-2026-00003', client_name: 'Raffles Medical', subtotal: 1570, tax_amount: 141.3, gst_rate_percent: 9, total_amount: 1711.3, status: 'approved', xero_invoice_id: null },
  { id: 4, booking_reference: 'BKG-2026-00004', client_name: 'NUS', subtotal: 1200, tax_amount: 108, gst_rate_percent: 9, total_amount: 1308, status: 'synced_to_xero', xero_invoice_id: 'INV-XR-0041' },
  { id: 5, booking_reference: 'BKG-2026-00005', client_name: 'ST Engineering', subtotal: 850, tax_amount: 76.5, gst_rate_percent: 9, total_amount: 926.5, status: 'failed', xero_invoice_id: null },
  { id: 6, booking_reference: 'BKG-2026-00006', client_name: 'SingHealth', subtotal: 0, tax_amount: 0, gst_rate_percent: null, total_amount: 0, status: 'unmatched', xero_invoice_id: null },
]

function mockList(rows = INVOICES) {
  mock.onGet('/invoices').reply(200, { success: true, data: { data: rows, meta: { total: rows.length } } })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/invoices']}>
      <ToastProvider>
        <InvoiceListPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

const rowFor = (reference) => screen.getByText(reference).closest('tr')

beforeEach(() => {
  mock = new MockAdapter(api)
  mockNavigate.mockClear()
})
afterEach(() => { mock.restore() })

describe('InvoiceListPage - listing and filters', () => {
  test('renders every invoice with its status and Xero id', async () => {
    mockList()
    renderPage()

    expect(await screen.findByText('BKG-2026-00001')).toBeInTheDocument()
    expect(screen.getByText('INV-XR-0041')).toBeInTheDocument()
    // The unmatched invoice has no Xero id; the cell must not be blank or read "null".
    expect(within(rowFor('BKG-2026-00006')).getAllByText('—').length).toBeGreaterThan(0)
  })

  test('shows the GST rate beside the tax amount so a zero-GST invoice is distinguishable', async () => {
    mockList()
    renderPage()

    await screen.findByText('BKG-2026-00001')
    // A 9% invoice states the rate; the unmatched one has no rate snapshot at all, so
    // showing "(0%)" there would assert a rate that was never applied.
    expect(within(rowFor('BKG-2026-00001')).getByText('$76.50 (9%)')).toBeInTheDocument()
    expect(within(rowFor('BKG-2026-00006')).queryByText(/%/)).not.toBeInTheDocument()
  })

  test('filter chips narrow the table to a single status and carry live counts', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00001')
    expect(screen.getByRole('button', { name: /^All \(6\)$/ })).toBeInTheDocument()

    // Anchored: an unanchored /matched \(1\)/ also matches the "unmatched (1)" chip.
    await user.click(screen.getByRole('button', { name: /^matched \(1\)$/i }))

    expect(screen.getByText('BKG-2026-00001')).toBeInTheDocument()
    expect(screen.queryByText('BKG-2026-00004')).not.toBeInTheDocument()
  })

  test('View navigates to the invoice detail route', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00003')
    await user.click(within(rowFor('BKG-2026-00003')).getByRole('button', { name: /view/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/invoices/3')
  })

  test('reports a failed load through a toast rather than an empty table', async () => {
    mock.onGet('/invoices').reply(500, { success: false, message: 'boom' })
    renderPage()

    expect(await screen.findByText(/failed to load invoices/i)).toBeInTheDocument()
  })
})

describe('InvoiceListPage - batch approve selection rules', () => {
  test('only matched and adjusted invoices can be selected', async () => {
    mockList()
    renderPage()

    await screen.findByText('BKG-2026-00001')

    // Approving an already-synced or unmatched invoice is meaningless; an unmatched one
    // has no priced line items at all, so pushing it to Xero would issue a $0 document.
    expect(within(rowFor('BKG-2026-00001')).getByRole('checkbox')).toBeEnabled()
    expect(within(rowFor('BKG-2026-00002')).getByRole('checkbox')).toBeEnabled()
    expect(within(rowFor('BKG-2026-00003')).getByRole('checkbox')).toBeDisabled()
    expect(within(rowFor('BKG-2026-00004')).getByRole('checkbox')).toBeDisabled()
    expect(within(rowFor('BKG-2026-00005')).getByRole('checkbox')).toBeDisabled()
    expect(within(rowFor('BKG-2026-00006')).getByRole('checkbox')).toBeDisabled()
  })

  test('the header checkbox selects only the approvable rows, never all six', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00001')
    const [selectAll] = screen.getAllByRole('checkbox')
    await user.click(selectAll)

    expect(screen.getByRole('button', { name: /Batch Approve & Sync \(2\)/ })).toBeInTheDocument()
  })

  test('the batch button is disabled until something is selected', async () => {
    mockList()
    renderPage()

    await screen.findByText('BKG-2026-00001')
    expect(screen.getByRole('button', { name: /Batch Approve & Sync \(0\)/ })).toBeDisabled()
  })

  test('clicking the header checkbox again clears the selection', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00001')
    const [selectAll] = screen.getAllByRole('checkbox')
    await user.click(selectAll)
    await user.click(selectAll)

    expect(screen.getByRole('button', { name: /Batch Approve & Sync \(0\)/ })).toBeDisabled()
  })
})

describe('InvoiceListPage - batch approve outcomes', () => {
  test('sends the selected ids and reports approved / synced / skipped counts', async () => {
    mockList()
    mock.onPost('/invoices/batch-approve').reply(200, {
      success: true,
      data: { approved: [1, 2], skipped: [], queued_for_xero: [1, 2] },
    })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00001')
    await user.click(within(rowFor('BKG-2026-00001')).getByRole('checkbox'))
    await user.click(within(rowFor('BKG-2026-00002')).getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /Batch Approve & Sync \(2\)/ }))

    expect(await screen.findByText(/Approved 2, synced 2 to Xero/i)).toBeInTheDocument()
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ invoice_ids: [1, 2] })
  })

  test('surfaces a partial Xero failure instead of reporting a clean success', async () => {
    mockList()
    // Both approved, but only one reached Xero. Collapsing this into "Approved 2" would
    // hide an invoice that is approved-but-unsent, which nobody would then retry.
    mock.onPost('/invoices/batch-approve').reply(200, {
      success: true,
      data: { approved: [1, 2], skipped: [], queued_for_xero: [1] },
    })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00001')
    const [selectAll] = screen.getAllByRole('checkbox')
    await user.click(selectAll)
    await user.click(screen.getByRole('button', { name: /Batch Approve & Sync \(2\)/ }))

    expect(await screen.findByText(/Approved 2, synced 1 to Xero/i)).toBeInTheDocument()
  })

  test('names the skipped invoices when the server refuses part of the batch', async () => {
    mockList()
    mock.onPost('/invoices/batch-approve').reply(200, {
      success: true,
      data: { approved: [1], skipped: [2], queued_for_xero: [1] },
    })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00001')
    const [selectAll] = screen.getAllByRole('checkbox')
    await user.click(selectAll)
    await user.click(screen.getByRole('button', { name: /Batch Approve & Sync \(2\)/ }))

    expect(await screen.findByText(/skipped 1/i)).toBeInTheDocument()
  })

  test('refreshes the table and clears the selection after a successful batch', async () => {
    mockList()
    mock.onPost('/invoices/batch-approve').reply(200, {
      success: true,
      data: { approved: [1, 2], skipped: [], queued_for_xero: [1, 2] },
    })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00001')
    const [selectAll] = screen.getAllByRole('checkbox')
    await user.click(selectAll)
    await user.click(screen.getByRole('button', { name: /Batch Approve & Sync \(2\)/ }))

    // Stale checkboxes after a batch would let the same invoices be submitted twice.
    await waitFor(() => expect(screen.getByRole('button', { name: /Batch Approve & Sync \(0\)/ })).toBeDisabled())
    expect(mock.history.get.filter((r) => r.url === '/invoices')).toHaveLength(2)
  })

  test('shows the server message when the whole batch fails', async () => {
    mockList()
    mock.onPost('/invoices/batch-approve').reply(422, { success: false, message: 'Xero connection expired.' })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00001')
    await user.click(within(rowFor('BKG-2026-00001')).getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /Batch Approve & Sync \(1\)/ }))

    expect(await screen.findByText('Xero connection expired.')).toBeInTheDocument()
  })
})
