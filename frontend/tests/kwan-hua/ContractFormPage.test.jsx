// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper.
// Create/Edit Contract Form (screen 13).
//
// The form is two different screens behind one component: create builds a whole contract
// (client + rates + surcharges), edit touches only the name and dates because changing a
// live contract's client or rates would silently re-price jobs. These tests pin that
// split, the duplicate-rate guard, and the zero-rate warning that stops a contract being
// saved in a state where it can never match anything.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import ContractFormPage from '@/pages/invoices/ContractFormPage'

const mockNavigate = jest.fn()
let mockParams = {}

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}))

jest.mock('@/hooks', () => ({
  useAuth: () => ({ user: { id: 2, role: 'ar_specialist' } }),
}))

const daysAway = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

const CLIENTS = [
  { id: 1, name: 'Tan Tock Seng Hospital' },
  { id: 2, name: 'ABC Corporation' },
]

let mock

function renderPage(initialEntry = '/pricing-contracts/new') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ToastProvider>
        <ContractFormPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

// Radix <Select> renders a combobox trigger; options only mount once it is opened.
async function chooseOption(user, combobox, optionLabel) {
  await user.click(combobox)
  await user.click(await screen.findByRole('option', { name: optionLabel }))
}

beforeEach(() => {
  mock = new MockAdapter(api)
  mockNavigate.mockClear()
  mockParams = {}
  mock.onGet('/clients').reply(200, { success: true, data: CLIENTS })
})
afterEach(() => { mock.restore() })

describe('ContractFormPage - create mode', () => {
  test('loads the client picker and shows the rate and surcharge sections', async () => {
    renderPage()

    expect(await screen.findByText('New Pricing Contract')).toBeInTheDocument()
    expect(screen.getByText(/add rate/i)).toBeInTheDocument()
    // Surcharges are pre-populated with sensible defaults so the form isn't all blanks.
    expect(screen.getByText('Oxygen Base')).toBeInTheDocument()
  })

  test('blocks submission when required fields are empty', async () => {
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('New Pricing Contract')
    await user.click(screen.getByRole('button', { name: /save contract/i }))

    await waitFor(() => expect(mock.history.post).toHaveLength(0))
  })

  test('rejects a duplicate service/transfer/time combination before it is added', async () => {
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('New Pricing Contract')

    // Scoped to the row holding the Add button: once a rate is added, the committed row
    // renders its own "Base amount" input, so an unscoped query matches two elements.
    const addOneRate = async () => {
      const addRow = screen.getByRole('button', { name: /^add$/i }).closest('tr')
      const comboboxes = within(addRow).getAllByRole('combobox')
      await chooseOption(user, comboboxes[0], 'EAS')
      await chooseOption(user, comboboxes[1], 'One-Way Hospital')
      await chooseOption(user, comboboxes[2], 'Office Hours')
      const amount = within(addRow).getByLabelText(/base amount/i)
      await user.clear(amount)
      await user.type(amount, '850')
      await user.click(screen.getByRole('button', { name: /^add$/i }))
    }

    await addOneRate()
    expect(await screen.findByText('$850.00')).toBeInTheDocument()

    await addOneRate()

    // The backend rejects duplicates with 409 RATE_DUPLICATE, but catching it here means
    // the user is told before losing a half-filled form to a round-trip.
    expect(await screen.findByText(/already in this list/i)).toBeInTheDocument()
    // Explicit timeout: this test drives nine Radix Select interactions, each with its own
    // open/animate/close cycle. It comfortably fits the 5s default in isolation but has
    // flaked once against it when the full suite runs all workers in parallel.
  }, 20000)

  test('passes the backend zero-rate warning through instead of a plain success', async () => {
    mock.onPost('/contracts').reply(201, {
      success: true,
      data: { id: 9, warning: 'This contract has no rates, so it cannot match any jobs yet.' },
    })
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('New Pricing Contract')

    await chooseOption(user, screen.getAllByRole('combobox')[0], 'Tan Tock Seng Hospital')
    await user.type(screen.getByLabelText(/contract name/i), 'TTSH FY2027')
    await user.type(screen.getByLabelText(/effective from/i), daysAway(1))
    await user.type(screen.getByLabelText(/effective to/i), daysAway(300))
    await user.click(screen.getByRole('button', { name: /save contract/i }))

    // A contract saved with zero rates is valid but inert - reporting only "created
    // successfully" would leave the AR Specialist believing it is ready to bill.
    expect(await screen.findByText(/cannot match any jobs yet/i)).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/pricing-contracts/9')
  })

  test('surfaces every field-level error the backend returns, not just the generic message', async () => {
    mock.onPost('/contracts').reply(400, {
      success: false,
      message: 'One or more fields failed validation.',
      errors: [
        { field: 'effective_to', message: 'must be after effective_from' },
        { field: 'contract_name', message: 'already exists for this client' },
      ],
    })
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('New Pricing Contract')

    await chooseOption(user, screen.getAllByRole('combobox')[0], 'ABC Corporation')
    await user.type(screen.getByLabelText(/contract name/i), 'Dup Name')
    await user.type(screen.getByLabelText(/effective from/i), daysAway(10))
    await user.type(screen.getByLabelText(/effective to/i), daysAway(300))
    await user.click(screen.getByRole('button', { name: /save contract/i }))

    expect(await screen.findByText(/must be after effective_from/i)).toBeInTheDocument()
    expect(screen.getByText(/already exists for this client/i)).toBeInTheDocument()
  })

  test('reports a failed client list load', async () => {
    mock.onGet('/clients').reply(500, { success: false })
    renderPage()

    expect(await screen.findByText(/failed to load client list/i)).toBeInTheDocument()
  })
})

describe('ContractFormPage - edit mode', () => {
  const existing = {
    id: 5,
    contract_name: 'TTSH FY2026 Agreement',
    client_name: 'Tan Tock Seng Hospital',
    client_id: 1,
    effective_from: daysAway(-30),
    effective_to: daysAway(300),
    is_active: true,
    rates: [],
    surcharges: [],
  }

  beforeEach(() => {
    mockParams = { id: '5' }
    mock.onGet('/contracts/5').reply(200, { success: true, data: existing })
  })

  test('loads the contract and hides the client, rate and surcharge sections', async () => {
    renderPage('/pricing-contracts/5/edit')

    expect(await screen.findByText('Edit Contract')).toBeInTheDocument()
    expect(screen.getByLabelText(/contract name/i)).toHaveValue('TTSH FY2026 Agreement')
    // Reassigning the client or editing rates here would silently re-price live jobs;
    // rate changes belong on the detail screen, one row at a time.
    expect(screen.queryByText(/add rate/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Oxygen Base')).not.toBeInTheDocument()
  })

  test('PATCHes only the name and dates', async () => {
    mock.onPatch('/contracts/5').reply(200, { success: true, data: existing })
    renderPage('/pricing-contracts/5/edit')
    const user = userEvent.setup()

    await screen.findByText('Edit Contract')
    const name = screen.getByLabelText(/contract name/i)
    await user.clear(name)
    await user.type(name, 'TTSH FY2026 (Revised)')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(mock.history.patch).toHaveLength(1))
    expect(Object.keys(JSON.parse(mock.history.patch[0].data)).sort())
      .toEqual(['contract_name', 'effective_from', 'effective_to'])
  })

  test('re-sends with acknowledge_matched_invoices when the user confirms', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    mock.onPatch('/contracts/5').replyOnce(400, {
      success: false, code: 'HAS_MATCHED_INVOICES', message: '4 invoices already use this contract.',
    })
    mock.onPatch('/contracts/5').reply(200, { success: true, data: existing })
    renderPage('/pricing-contracts/5/edit')
    const user = userEvent.setup()

    await screen.findByText('Edit Contract')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(mock.history.patch).toHaveLength(2))
    expect(JSON.parse(mock.history.patch[1].data).acknowledge_matched_invoices).toBe(true)
    expect(await screen.findByText(/contract updated successfully/i)).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  test('declining the acknowledgment neither retries nor navigates away', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    mock.onPatch('/contracts/5').reply(400, {
      success: false, code: 'HAS_MATCHED_INVOICES', message: '4 invoices already use this contract.',
    })
    renderPage('/pricing-contracts/5/edit')
    const user = userEvent.setup()

    await screen.findByText('Edit Contract')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(mock.history.patch).toHaveLength(1))
    // Leaving the form open preserves the user's edits so a deliberate Cancel is not
    // punished by losing them.
    expect(mockNavigate).not.toHaveBeenCalledWith('/pricing-contracts/5')
    confirmSpy.mockRestore()
  })

  test('reports a failed contract load', async () => {
    mock.onGet('/contracts/5').reply(500, { success: false })
    renderPage('/pricing-contracts/5/edit')

    expect(await screen.findByText(/failed to load contract/i)).toBeInTheDocument()
  })
})
