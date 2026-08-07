// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper.
// Pricing Contract Detail (screen 12): rate CRUD, surcharge batch edit, read-only states.
//
// Two behaviours here carry real billing risk and are the reason this file exists:
//   1. The HAS_MATCHED_INVOICES acknowledgment round-trip. Editing a contract that has
//      already priced invoices needs explicit consent, and a declined confirm must not be
//      reported as a failure.
//   2. The surcharge save is 12 independent PUTs with no transaction. A partial failure
//      must name the rows that failed and keep the ones that saved.
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import ContractDetailPage from '@/pages/invoices/ContractDetailPage'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: '1' }),
}))

jest.mock('@/hooks', () => ({
  useAuth: () => ({ user: { id: 2, role: 'ar_specialist' } }),
}))

const daysAway = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

function contractFixture(overrides = {}) {
  return {
    id: 1,
    contract_name: 'TTSH FY2026 Agreement',
    client_name: 'Tan Tock Seng Hospital',
    is_active: true,
    effective_from: daysAway(-30),
    effective_to: daysAway(300),
    matched_invoice_count: 0,
    rates: [
      { id: 11, service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: '850.00' },
      { id: 12, service_type: 'mts', transfer_type: 'two_way_hospital', time_of_day: 'all_hours', base_amount: '900.00' },
    ],
    surcharges: [
      { id: 21, surcharge_type: 'oxygen_base', amount: '50.00' },
      { id: 22, surcharge_type: 'resuscitation', amount: '320.00' },
    ],
    ...overrides,
  }
}

let mock
let confirmSpy

function mockContract(overrides) {
  mock.onGet('/contracts/1').reply(200, { success: true, data: contractFixture(overrides) })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/pricing-contracts/1']}>
      <ToastProvider>
        <ContractDetailPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  mock = new MockAdapter(api)
  mockNavigate.mockClear()
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => {
  mock.restore()
  confirmSpy.mockRestore()
})

describe('ContractDetailPage - rendering', () => {
  test('renders rates and surcharges with human-readable enum labels', async () => {
    mockContract()
    renderPage()

    expect(await screen.findByText('TTSH FY2026 Agreement')).toBeInTheDocument()
    expect(screen.getByText('One-Way Hospital')).toBeInTheDocument()
    expect(screen.getByText('Office Hours')).toBeInTheDocument()
    expect(screen.getByText('$850.00')).toBeInTheDocument()
    expect(screen.getByText('Oxygen Base')).toBeInTheDocument()
    expect(screen.getByText('$320.00')).toBeInTheDocument()
  })

  test('warns that editing will not retroactively change already-matched invoices', async () => {
    mockContract({ matched_invoice_count: 7 })
    renderPage()

    expect(await screen.findByText(/7 invoice\(s\) have already been matched/i)).toBeInTheDocument()
  })

  test('tells the user the pricing engine cannot match anything when a contract has no rates', async () => {
    mockContract({ rates: [] })
    renderPage()

    expect(await screen.findByText(/pricing engine cannot match jobs/i)).toBeInTheDocument()
  })
})

describe('ContractDetailPage - read-only states', () => {
  test('an expired contract hides every editing control', async () => {
    mockContract({ is_active: false, effective_from: daysAway(-400), effective_to: daysAway(-30) })
    renderPage()

    expect(await screen.findByText(/expired and read-only/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add rate/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit surcharges/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^deactivate$/i })).not.toBeInTheDocument()
  })

  test('a manually deactivated contract is read-only and says so distinctly from expired', async () => {
    mockContract({ is_active: false, effective_to: daysAway(200) })
    renderPage()

    expect(await screen.findByText(/deactivated and is read-only/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add rate/i })).not.toBeInTheDocument()
  })

  test('an upcoming contract stays editable and says when it starts matching', async () => {
    mockContract({ effective_from: daysAway(20) })
    renderPage()

    expect(await screen.findByText(/has not started yet/i)).toBeInTheDocument()
    // Editable on purpose: rates must be settable before the contract goes live.
    expect(screen.getByRole('button', { name: /add rate/i })).toBeInTheDocument()
  })
})

describe('ContractDetailPage - rate management', () => {
  test('rejects an incomplete new rate before calling the API', async () => {
    mockContract()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(screen.getByRole('button', { name: /add rate/i }))
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    // rateSchema runs client-side first, so an empty row never reaches the network.
    // The exact message depends on which field Yup reports first, so assert the
    // guarantee that matters rather than pinning the wording.
    await screen.findByText(/required|must be a number/i)
    expect(mock.history.post).toHaveLength(0)
  })

  test('saving an edited base amount PUTs only base_amount and reloads', async () => {
    mockContract()
    mock.onPut('/contracts/1/rates/11').reply(200, { success: true, data: { id: 11, base_amount: '900.00' } })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    const rateRow = screen.getByText('One-Way Hospital').closest('tr')
    await user.click(within(rateRow).getAllByRole('button')[0]) // pencil

    const input = within(rateRow).getByLabelText(/base amount/i)
    await user.clear(input)
    await user.type(input, '900')
    await user.click(within(rateRow).getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/rate updated/i)).toBeInTheDocument()
    // service/transfer/time are immutable once created - changing them would silently
    // change which jobs the rate matches, so delete + re-add is the intended path.
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ base_amount: 900 })
  })

  test('deleting a rate asks for confirmation first', async () => {
    mockContract()
    mock.onDelete('/contracts/1/rates/11').reply(200, { success: true, data: {} })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    const rateRow = screen.getByText('One-Way Hospital').closest('tr')
    await user.click(within(rateRow).getAllByRole('button')[1]) // trash

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/cannot be undone/i))
    expect(await screen.findByText(/rate deleted/i)).toBeInTheDocument()
  })

  test('declining the delete confirmation leaves the rate alone', async () => {
    confirmSpy.mockReturnValue(false)
    mockContract()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    const rateRow = screen.getByText('One-Way Hospital').closest('tr')
    await user.click(within(rateRow).getAllByRole('button')[1])

    expect(mock.history.delete).toHaveLength(0)
  })

  test('surfaces RATE_IN_USE when the backend refuses to delete a billed rate', async () => {
    mockContract()
    mock.onDelete('/contracts/1/rates/11').reply(409, {
      success: false, code: 'RATE_IN_USE', message: 'This rate has already been used to bill an invoice.',
    })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    const rateRow = screen.getByText('One-Way Hospital').closest('tr')
    await user.click(within(rateRow).getAllByRole('button')[1])

    expect(await screen.findByText(/already been used to bill an invoice/i)).toBeInTheDocument()
  })
})

describe('ContractDetailPage - matched-invoice acknowledgment', () => {
  test('re-sends the deactivate with acknowledge_matched_invoices once confirmed', async () => {
    mockContract({ matched_invoice_count: 3 })
    mock.onPatch('/contracts/1').replyOnce(400, {
      success: false, code: 'HAS_MATCHED_INVOICES', message: '3 invoices already use this contract.',
    })
    mock.onPatch('/contracts/1').reply(200, { success: true, data: contractFixture({ is_active: false }) })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() => expect(mock.history.patch).toHaveLength(2))
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ is_active: false })
    expect(JSON.parse(mock.history.patch[1].data)).toEqual({ is_active: false, acknowledge_matched_invoices: true })
    expect(await screen.findByText(/contract deactivated/i)).toBeInTheDocument()
  })

  test('declining the acknowledgment does not retry and does not report an error', async () => {
    // The declined path shares a code path with a genuine API failure; reporting a
    // deliberate Cancel as an error would train the user to ignore error toasts.
    confirmSpy.mockReturnValueOnce(true).mockReturnValueOnce(false)
    mockContract({ matched_invoice_count: 3 })
    mock.onPatch('/contracts/1').reply(400, {
      success: false, code: 'HAS_MATCHED_INVOICES', message: '3 invoices already use this contract.',
    })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() => expect(mock.history.patch).toHaveLength(1))
    expect(screen.queryByText(/failed to deactivate/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/contract deactivated/i)).not.toBeInTheDocument()
  })
})

describe('ContractDetailPage - surcharge batch edit', () => {
  test('saves every surcharge as its own PUT and confirms once', async () => {
    mockContract()
    mock.onPut('/contracts/1/surcharges/21').reply(200, { success: true, data: {} })
    mock.onPut('/contracts/1/surcharges/22').reply(200, { success: true, data: {} })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(screen.getByRole('button', { name: /edit surcharges/i }))

    const oxygen = screen.getByLabelText(/oxygen base amount/i)
    await user.clear(oxygen)
    await user.type(oxygen, '60')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/surcharge schedule updated/i)).toBeInTheDocument()
    expect(mock.history.put).toHaveLength(2)
  })

  test('names the failed rows and keeps the successful ones when the batch is partial', async () => {
    mockContract()
    mock.onPut('/contracts/1/surcharges/21').reply(200, { success: true, data: {} })
    mock.onPut('/contracts/1/surcharges/22').reply(500, { success: false, message: 'boom' })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(screen.getByRole('button', { name: /edit surcharges/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // There is no transaction across the 12 PUTs, so "everything failed" would be a lie.
    // The user must be told exactly which row to retry.
    expect(await screen.findByText(/Failed to update: Resuscitation/i)).toBeInTheDocument()
    expect(screen.getByText(/Other changes were saved/i)).toBeInTheDocument()
  })

  test('a negative surcharge cannot be typed at all', async () => {
    mockContract()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(screen.getByRole('button', { name: /edit surcharges/i }))

    const oxygen = screen.getByLabelText(/oxygen base amount/i)
    await user.clear(oxygen)
    await user.type(oxygen, '-5')

    // NumberStepper's input mask (/^\d*\.?\d{0,2}$/) rejects the minus sign outright, so
    // a negative amount is unreachable through the UI rather than merely caught on save.
    expect(oxygen).toHaveValue('5')
  })

  test('rejects more than two decimal places on a surcharge amount', async () => {
    mockContract()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(screen.getByRole('button', { name: /edit surcharges/i }))

    const oxygen = screen.getByLabelText(/oxygen base amount/i)
    await user.clear(oxygen)
    await user.type(oxygen, '50.999')

    // Money with 3+ decimals would round unpredictably once it reaches the invoice.
    expect(oxygen).toHaveValue('50.99')
  })

  test('Cancel exits edit mode without sending anything', async () => {
    mockContract()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(screen.getByRole('button', { name: /edit surcharges/i }))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.getByRole('button', { name: /edit surcharges/i })).toBeInTheDocument()
    expect(mock.history.put).toHaveLength(0)
  })
})
