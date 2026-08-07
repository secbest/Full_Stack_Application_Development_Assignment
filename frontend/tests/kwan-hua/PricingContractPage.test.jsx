// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper.
// Pricing Contracts List (screen 11): derived status, inactive visibility, search.
//
// The interesting logic here is getContractDisplayStatus, which derives FOUR states from
// two backend fields (is_active + effective_to). The expired/deactivated split matters
// commercially - "lapsed on its end date" and "withdrawn early by a human" need different
// follow-up - and it exists only in the UI, so nothing but these tests protects it.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import PricingContractPage from '@/pages/invoices/PricingContractPage'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

jest.mock('@/hooks', () => ({
  useAuth: () => ({ user: { id: 2, role: 'ar_specialist' } }),
}))

// Dates are relative to today so the derived status never rots as the calendar moves -
// a hard-coded 2026 fixture would silently flip from "active" to "expired" in production.
const daysAway = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

const CONTRACTS = [
  { id: 1, contract_name: 'TTSH FY2026 Agreement', client_name: 'Tan Tock Seng Hospital', is_active: true,  effective_from: daysAway(-30), effective_to: daysAway(300) },
  { id: 2, contract_name: 'ABC Corp Standby',      client_name: 'ABC Corporation',        is_active: true,  effective_from: daysAway(30),  effective_to: daysAway(300) },
  { id: 3, contract_name: 'SingHealth FY2025',     client_name: 'SingHealth Group',       is_active: false, effective_from: daysAway(-400), effective_to: daysAway(-30) },
  { id: 4, contract_name: 'NUS Withdrawn Deal',    client_name: 'NUS',                    is_active: false, effective_from: daysAway(-10), effective_to: daysAway(200) },
]

let mock

function mockList(rows = CONTRACTS, total = rows.length) {
  mock.onGet('/contracts').reply(200, { success: true, data: { data: rows, meta: { total } } })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/pricing-contracts']}>
      <ToastProvider>
        <PricingContractPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

const rowFor = (name) => screen.getByText(name).closest('tr')
const showInactiveToggle = () => screen.getByRole('checkbox', { name: /show inactive contracts/i })

beforeEach(() => {
  mock = new MockAdapter(api)
  mockNavigate.mockClear()
})
afterEach(() => { mock.restore() })

describe('PricingContractPage - derived status', () => {
  test('an in-range active contract shows as Active', async () => {
    mockList()
    renderPage()

    await screen.findByText('TTSH FY2026 Agreement')
    expect(within(rowFor('TTSH FY2026 Agreement')).getByText(/active/i)).toBeInTheDocument()
  })

  test('an active contract that has not started yet shows as Upcoming, not Active', async () => {
    mockList()
    renderPage()

    await screen.findByText('ABC Corp Standby')
    // is_active is true, but billing against it today would use a rate not yet in force.
    expect(within(rowFor('ABC Corp Standby')).getByText(/upcoming/i)).toBeInTheDocument()
  })

  test('distinguishes a lapsed contract (Expired) from one withdrawn early (Deactivated)', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(showInactiveToggle())

    // Both are is_active: false. Only effective_to separates them, and the difference
    // matters: an expired contract needs renewing, a deactivated one was killed on purpose.
    expect(within(rowFor('SingHealth FY2025')).getByText(/expired/i)).toBeInTheDocument()
    expect(within(rowFor('NUS Withdrawn Deal')).getByText(/deactivated/i)).toBeInTheDocument()
  })

  test('renders inactive rows at 50% opacity per the screen spec', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(showInactiveToggle())

    expect(rowFor('SingHealth FY2025')).toHaveClass('opacity-50')
    expect(rowFor('TTSH FY2026 Agreement')).not.toHaveClass('opacity-50')
  })
})

describe('PricingContractPage - inactive visibility', () => {
  test('hides deactivated and expired contracts by default and says how many are hidden', async () => {
    mockList()
    renderPage()

    await screen.findByText('TTSH FY2026 Agreement')
    expect(screen.queryByText('SingHealth FY2025')).not.toBeInTheDocument()
    expect(screen.queryByText('NUS Withdrawn Deal')).not.toBeInTheDocument()
    // Silently omitting them would make the list look complete when it isn't.
    expect(screen.getByText(/2 hidden/)).toBeInTheDocument()
  })

  test('the inactive filter tabs only appear once inactive contracts are shown', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    expect(screen.queryByRole('button', { name: 'Expired' })).not.toBeInTheDocument()

    await user.click(showInactiveToggle())

    expect(screen.getByRole('button', { name: 'Expired' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deactivated' })).toBeInTheDocument()
  })

  test('hiding inactive contracts while viewing Expired falls back to All Contracts', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(showInactiveToggle())
    await user.click(screen.getByRole('button', { name: 'Expired' }))
    expect(screen.getByText('SingHealth FY2025')).toBeInTheDocument()

    await user.click(showInactiveToggle())

    // Without the reset the user is stranded on a tab that no longer exists, looking at
    // an empty table with no obvious way back.
    expect(screen.getByText('TTSH FY2026 Agreement')).toBeInTheDocument()
    expect(screen.queryByText('SingHealth FY2025')).not.toBeInTheDocument()
  })
})

describe('PricingContractPage - filtering and search', () => {
  test('the Active tab excludes upcoming contracts', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(screen.getByRole('button', { name: 'Active' }))

    expect(screen.getByText('TTSH FY2026 Agreement')).toBeInTheDocument()
    expect(screen.queryByText('ABC Corp Standby')).not.toBeInTheDocument()
  })

  test('search matches the client name as well as the contract name', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.type(screen.getByPlaceholderText(/search by client or contract name/i), 'Tan Tock')

    expect(screen.getByText('TTSH FY2026 Agreement')).toBeInTheDocument()
    expect(screen.queryByText('ABC Corp Standby')).not.toBeInTheDocument()
  })

  test('search is case-insensitive', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.type(screen.getByPlaceholderText(/search by client or contract name/i), 'abc corp')

    expect(screen.getByText('ABC Corp Standby')).toBeInTheDocument()
  })

  test('shows an explicit empty state when nothing matches', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.type(screen.getByPlaceholderText(/search by client or contract name/i), 'nonexistent')

    expect(screen.getByText(/no contracts match the current filters/i)).toBeInTheDocument()
  })
})

describe('PricingContractPage - navigation and failure states', () => {
  test('View opens the contract detail route', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(within(rowFor('TTSH FY2026 Agreement')).getByRole('button', { name: 'View' }))

    expect(mockNavigate).toHaveBeenCalledWith('/pricing-contracts/1')
  })

  test('New Contract opens the create form', async () => {
    mockList()
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('TTSH FY2026 Agreement')
    await user.click(screen.getByRole('button', { name: /new contract/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/pricing-contracts/new')
  })

  test('warns when more contracts exist than the unpaginated screen can show', async () => {
    mockList(CONTRACTS, 142)
    renderPage()

    // Screen 11 has no pagination yet. Showing 100 of 142 without saying so would let an
    // AR Specialist conclude a client has no contract when it is simply off the end.
    expect(await screen.findByText(/42 more exist but aren't shown/i)).toBeInTheDocument()
  })

  test('reports a failed load through a toast', async () => {
    mock.onGet('/contracts').reply(500, { success: false, message: 'boom' })
    renderPage()

    expect(await screen.findByText(/failed to load pricing contracts/i)).toBeInTheDocument()
  })
})
