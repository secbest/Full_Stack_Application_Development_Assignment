// Owner: Jasper - Wave 2B (Pricing Contracts List, screen 11).
// Exercises GET /api/contracts via axios-mock-adapter against the shared `api` axios
// instance - same pattern as ContractFormPage.test.jsx.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import PricingContractPage from '@/pages/invoices/PricingContractPage'

function daysFromNow(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

// One contract per getContractDisplayStatus() outcome (frontend/src/lib/contractLabels.js):
// is_active=false decides expired-vs-deactivated by whether effective_to has already lapsed.
const ACTIVE_CONTRACT = { id: 1, contract_name: 'TTSH - FY2027', client_name: 'Tan Tock Seng Hospital', effective_from: daysFromNow(-10), effective_to: daysFromNow(100), is_active: true }
const UPCOMING_CONTRACT = { id: 2, contract_name: 'SGH - FY2028', client_name: 'Singapore General Hospital', effective_from: daysFromNow(10), effective_to: daysFromNow(100), is_active: true }
const EXPIRED_CONTRACT = { id: 3, contract_name: 'CGH - FY2025 (lapsed)', client_name: 'Changi General Hospital', effective_from: daysFromNow(-400), effective_to: daysFromNow(-5), is_active: true }
const DEACTIVATED_CONTRACT = { id: 4, contract_name: 'NUH - Withdrawn', client_name: 'National University Hospital', effective_from: daysFromNow(-50), effective_to: daysFromNow(200), is_active: false }

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
})

afterEach(() => {
  mock.reset()
})

// contractController.listContracts responds via success(res, { data: rows, meta }),
// and success() wraps that whole object in another { success, data } envelope - so the
// real wire shape is double-nested: { success, data: { data: [...], meta } }, which is
// exactly what api/contracts.js's listContracts() comment documents before unwrapping
// the outer envelope with res.data.data.
function contractsResponse(rows) {
  return { success: true, data: { data: rows, meta: { total: rows.length, page: 1, limit: 100 } } }
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/pricing-contracts']}>
        <Routes>
          <Route path="/pricing-contracts" element={<PricingContractPage />} />
          <Route path="/pricing-contracts/new" element={<div>New Contract Stub</div>} />
          <Route path="/pricing-contracts/:id" element={<div>Contract Detail Stub</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('PricingContractPage - list and filter (GET /api/contracts)', () => {
  test('shows only active/upcoming contracts by default, hiding expired/deactivated', async () => {
    mock.onGet('/contracts').reply(200, contractsResponse([ACTIVE_CONTRACT, UPCOMING_CONTRACT, EXPIRED_CONTRACT, DEACTIVATED_CONTRACT]))

    renderPage()

    expect(await screen.findByText('TTSH - FY2027')).toBeInTheDocument()
    expect(screen.getByText('SGH - FY2028')).toBeInTheDocument()
    expect(screen.queryByText('CGH - FY2025 (lapsed)')).not.toBeInTheDocument()
    expect(screen.queryByText('NUH - Withdrawn')).not.toBeInTheDocument()
    expect(screen.getByText(/2 hidden/)).toBeInTheDocument()
  })

  test('checking "Show inactive contracts" reveals the Expired/Deactivated tabs and rows', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts').reply(200, contractsResponse([ACTIVE_CONTRACT, EXPIRED_CONTRACT, DEACTIVATED_CONTRACT]))

    renderPage()
    await screen.findByText('TTSH - FY2027')

    await user.click(screen.getByRole('checkbox'))

    expect(await screen.findByText('CGH - FY2025 (lapsed)')).toBeInTheDocument()
    expect(screen.getByText('NUH - Withdrawn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expired' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deactivated' })).toBeInTheDocument()
  })

  test('the Upcoming filter tab shows only upcoming contracts', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts').reply(200, contractsResponse([ACTIVE_CONTRACT, UPCOMING_CONTRACT]))

    renderPage()
    await screen.findByText('TTSH - FY2027')

    await user.click(screen.getByRole('button', { name: 'Upcoming' }))

    expect(screen.queryByText('TTSH - FY2027')).not.toBeInTheDocument()
    expect(screen.getByText('SGH - FY2028')).toBeInTheDocument()
  })

  test('the search box filters by client name', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts').reply(200, contractsResponse([ACTIVE_CONTRACT, UPCOMING_CONTRACT]))

    renderPage()
    await screen.findByText('TTSH - FY2027')

    await user.type(screen.getByPlaceholderText(/Search by client or contract name/i), 'Singapore General')

    expect(screen.queryByText('TTSH - FY2027')).not.toBeInTheDocument()
    expect(screen.getByText('SGH - FY2028')).toBeInTheDocument()
  })

  test('"New Contract" navigates to the create form', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts').reply(200, contractsResponse([]))

    renderPage()
    await screen.findByText(/No contracts match/i)

    await user.click(screen.getByRole('button', { name: /New Contract/i }))

    expect(await screen.findByText('New Contract Stub')).toBeInTheDocument()
  })

  test('"View" navigates to that contract\'s detail page', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts').reply(200, contractsResponse([ACTIVE_CONTRACT]))

    renderPage()
    await screen.findByText('TTSH - FY2027')

    await user.click(screen.getByRole('button', { name: 'View' }))

    expect(await screen.findByText('Contract Detail Stub')).toBeInTheDocument()
  })

  test('a failed load shows an error toast and the empty state', async () => {
    mock.onGet('/contracts').reply(500, { success: false, code: 'INTERNAL_ERROR', message: 'boom' })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load pricing contracts.')
    await waitFor(() => expect(screen.getByText(/No contracts match/i)).toBeInTheDocument())
  })
})
