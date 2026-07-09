// Owner: Jasper - Wave 2B (Pricing Contract Detail, screen 12).
// Exercises GET/PATCH /api/contracts/:id, rate add/edit/delete, and surcharge update via
// axios-mock-adapter against the shared `api` axios instance.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import ContractDetailPage from '@/pages/invoices/ContractDetailPage'

function daysFromNow(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

// getContractById returns a flat { success, data: {...} } body - unlike listContracts,
// which double-nests (see PricingContractPage.test.jsx) - so no extra wrapper needed here.
function baseContract(overrides = {}) {
  return {
    id: 7,
    client_id: 1,
    client_name: 'Tan Tock Seng Hospital',
    contract_name: 'TTSH - FY2027',
    effective_from: daysFromNow(-10),
    effective_to: daysFromNow(300),
    is_active: true,
    rates: [{ id: 1, service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: '850.00' }],
    surcharges: [{ id: 1, surcharge_type: 'oxygen_base', amount: '50.00' }],
    matched_invoice_count: 0,
    ...overrides,
  }
}

let mock
let confirmSpy

beforeEach(() => {
  mock = new MockAdapter(api)
  confirmSpy = jest.spyOn(window, 'confirm')
})

afterEach(() => {
  mock.reset()
  confirmSpy.mockRestore()
})

function renderDetail(contractId = 7) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/pricing-contracts/${contractId}`]}>
        <Routes>
          <Route path="/pricing-contracts/:id" element={<ContractDetailPage />} />
          <Route path="/pricing-contracts" element={<div>Pricing Contracts List Stub</div>} />
          <Route path="/pricing-contracts/:id/edit" element={<div>Edit Contract Stub</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('ContractDetailPage - load', () => {
  test('renders contract header, rates, and surcharges once loaded', async () => {
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })

    renderDetail()

    expect(await screen.findByRole('heading', { name: 'TTSH - FY2027' })).toBeInTheDocument()
    expect(screen.getByText('EAS')).toBeInTheDocument()
    expect(screen.getByText('$850.00')).toBeInTheDocument()
    expect(screen.getByText('Oxygen Base')).toBeInTheDocument()
    expect(screen.getByText('$50.00')).toBeInTheDocument()
  })

  test('shows "Contract not found." when the load fails', async () => {
    mock.onGet('/contracts/999').reply(404, { success: false, code: 'CONTRACT_NOT_FOUND', message: 'No contract with this id.' })

    renderDetail(999)

    expect(await screen.findByText('Contract not found.')).toBeInTheDocument()
  })

  test('shows the matched-invoice warning banner when matched_invoice_count > 0', async () => {
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract({ matched_invoice_count: 12 }) })

    renderDetail()

    expect(await screen.findByText(/12 invoice\(s\) have already been matched/i)).toBeInTheDocument()
  })
})

describe('ContractDetailPage - add rate (POST /rates)', () => {
  test('client-side validation blocks an incomplete row before any request is sent', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })

    await user.click(screen.getByRole('button', { name: /Add Rate/i }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // rateSchema (frontend/src/validation/contractValidation.js) blocks the empty row
    // client-side - which exact field's message wins depends on Yup's validation order,
    // so this just confirms *a* validation error surfaced and no request went out.
    expect(await screen.findByRole('alert')).not.toHaveTextContent('')
    expect(mock.history.post).toHaveLength(0)
  })

  test('adding a rate posts to /contracts/:id/rates and reloads the contract', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })
    mock.onPost('/contracts/7/rates').reply(201, {
      success: true,
      data: { id: 2, contract_id: 7, service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: '1800.00' },
    })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })
    // Second GET (the reload after adding) returns the updated rate list.
    mock.onGet('/contracts/7').reply(200, {
      success: true,
      data: baseContract({ rates: [
        { id: 1, service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: '850.00' },
        { id: 2, service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: '1800.00' },
      ] }),
    })

    // The "add rate" row is a grid <div> above the rates table, not a <tr>. MiniSelect
    // doesn't associate a <Label> with its trigger, so the three comboboxes have no
    // accessible name to query by - only their fixed left-to-right order (Type,
    // Transfer type, Time of day) distinguishes them.
    await user.click(screen.getByRole('button', { name: /Add Rate/i }))
    const [typeSelect, transferSelect, timeSelect] = screen.getAllByRole('combobox')

    await user.click(typeSelect)
    await user.click(await screen.findByRole('option', { name: 'MTS' }))
    await user.click(transferSelect)
    await user.click(await screen.findByRole('option', { name: 'SG-JB Ground' }))
    await user.click(timeSelect)
    await user.click(await screen.findByRole('option', { name: 'All Hours' }))
    await user.type(screen.getByPlaceholderText('0.00'), '1800')

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Rate added.')
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({
      service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: 1800,
    })
    expect(await screen.findByText('MTS')).toBeInTheDocument()
  })

  test('a 409 RATE_DUPLICATE from the backend shows the backend message as a toast', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })
    mock.onPost('/contracts/7/rates').reply(409, {
      success: false, code: 'RATE_DUPLICATE',
      message: 'A rate row with the same service_type, transfer_type, and time_of_day already exists on this contract.',
    })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })

    await user.click(screen.getByRole('button', { name: /Add Rate/i }))
    const [typeSelect, transferSelect, timeSelect] = screen.getAllByRole('combobox')

    await user.click(typeSelect)
    await user.click(await screen.findByRole('option', { name: 'EAS' }))
    await user.click(transferSelect)
    await user.click(await screen.findByRole('option', { name: 'One-Way Hospital' }))
    await user.click(timeSelect)
    await user.click(await screen.findByRole('option', { name: 'Office Hours' }))
    await user.type(screen.getByPlaceholderText('0.00'), '900')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A rate row with the same service_type')
  })
})

describe('ContractDetailPage - edit and delete rate', () => {
  test('editing a rate\'s amount sends a PUT and shows the updated value', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })
    mock.onPut('/contracts/7/rates/1').reply(200, {
      success: true,
      data: { id: 1, contract_id: 7, service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: '950.00' },
    })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })
    mock.onGet('/contracts/7').reply(200, {
      success: true,
      data: baseContract({ rates: [{ id: 1, service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: '950.00' }] }),
    })

    // Pencil (edit) and trash (delete) are both icon-only buttons with no accessible
    // name, in that order - pencil is index 0.
    const rateRow = screen.getByText('$850.00').closest('tr')
    const [editButton] = within(rateRow).getAllByRole('button')
    await user.click(editButton)

    // editAmount seeds from String(r.base_amount), and the API returns base_amount as
    // a decimal string ("850.00"), not a bare integer.
    const amountInput = screen.getByDisplayValue('850.00')
    await user.clear(amountInput)
    await user.type(amountInput, '950')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Rate updated.')
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ base_amount: 950 })
  })

  test('deleting a rate asks for confirmation, then sends DELETE on confirm', async () => {
    const user = userEvent.setup()
    confirmSpy.mockReturnValue(true)
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })
    mock.onDelete('/contracts/7/rates/1').reply(200, { success: true, data: { message: 'Rate row deleted.' } })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract({ rates: [] }) })

    const rateRow = screen.getByText('$850.00').closest('tr')
    const [, deleteButton] = within(rateRow).getAllByRole('button')
    await user.click(deleteButton)

    expect(confirmSpy).toHaveBeenCalledWith('Delete this rate row? This cannot be undone.')
    expect(await screen.findByRole('alert')).toHaveTextContent('Rate deleted.')
    expect(mock.history.delete).toHaveLength(1)
  })

  test('declining the delete confirmation sends no request', async () => {
    const user = userEvent.setup()
    confirmSpy.mockReturnValue(false)
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })

    const rateRow = screen.getByText('$850.00').closest('tr')
    const [, deleteButton] = within(rateRow).getAllByRole('button')
    await user.click(deleteButton)

    expect(mock.history.delete).toHaveLength(0)
  })
})

describe('ContractDetailPage - deactivate (UC-02)', () => {
  test('deactivating a contract with no matched invoices succeeds on the first confirm', async () => {
    const user = userEvent.setup()
    confirmSpy.mockReturnValue(true)
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })
    mock.onPatch('/contracts/7').reply(200, { success: true, data: { id: 7, is_active: false } })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract({ is_active: false }) })

    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(confirmSpy).toHaveBeenCalledWith('Deactivate this contract? It will stop matching new jobs immediately.')
    expect(await screen.findByRole('alert')).toHaveTextContent('Contract deactivated.')
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ is_active: false })
  })

  test('a HAS_MATCHED_INVOICES 400 shows a second confirm, and resubmits with acknowledge_matched_invoices on accept', async () => {
    const user = userEvent.setup()
    // First confirm = the deactivate prompt itself; second = the matched-invoices re-confirm.
    confirmSpy.mockReturnValueOnce(true).mockReturnValueOnce(true)
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })
    let patchCall = 0
    mock.onPatch('/contracts/7').reply(() => {
      patchCall += 1
      if (patchCall === 1) {
        return [400, { success: false, code: 'HAS_MATCHED_INVOICES', message: '3 invoice(s) have already been matched using this contract.', matched_invoice_count: 3 }]
      }
      return [200, { success: true, data: { id: 7, is_active: false } }]
    })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract({ is_active: false, matched_invoice_count: 3 }) })

    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(mock.history.patch).toHaveLength(2))
    expect(JSON.parse(mock.history.patch[1].data)).toMatchObject({ is_active: false, acknowledge_matched_invoices: true })
    expect(await screen.findByRole('alert')).toHaveTextContent('Contract deactivated.')
  })

  test('declining the matched-invoices re-confirm sends no second request', async () => {
    const user = userEvent.setup()
    confirmSpy.mockReturnValueOnce(true).mockReturnValueOnce(false)
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })
    mock.onPatch('/contracts/7').reply(400, { success: false, code: 'HAS_MATCHED_INVOICES', message: '3 invoice(s) have already been matched using this contract.', matched_invoice_count: 3 })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })

    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(mock.history.patch).toHaveLength(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ContractDetailPage - surcharge schedule', () => {
  test('editing surcharges saves each row independently and reports partial failure', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts/7').reply(200, {
      success: true,
      data: baseContract({ surcharges: [
        { id: 1, surcharge_type: 'oxygen_base', amount: '50.00' },
        { id: 2, surcharge_type: 'resuscitation', amount: '320.00' },
      ] }),
    })
    mock.onPut('/contracts/7/surcharges/1').reply(200, { success: true, data: { id: 1, contract_id: 7, surcharge_type: 'oxygen_base', amount: 60 } })
    mock.onPut('/contracts/7/surcharges/2').reply(500, { success: false, code: 'INTERNAL_ERROR', message: 'boom' })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })

    await user.click(screen.getByRole('button', { name: 'Edit Surcharges' }))
    const oxygenInput = screen.getAllByRole('spinbutton')[0]
    await user.clear(oxygenInput)
    await user.type(oxygenInput, '60')

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Resuscitation/)
    expect(mock.history.put).toHaveLength(2)
  })

  test('canceling surcharge edit mode sends no requests', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts/7').reply(200, { success: true, data: baseContract() })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })

    await user.click(screen.getByRole('button', { name: 'Edit Surcharges' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mock.history.put).toHaveLength(0)
    expect(screen.getByText('Edit Surcharges')).toBeInTheDocument()
  })
})

describe('ContractDetailPage - read-only states', () => {
  test('an expired contract hides Edit/Deactivate/Add Rate and shows the read-only note', async () => {
    mock.onGet('/contracts/7').reply(200, {
      success: true,
      data: baseContract({ effective_from: daysFromNow(-400), effective_to: daysFromNow(-5) }),
    })

    renderDetail()
    await screen.findByRole('heading', { name: 'TTSH - FY2027' })

    expect(screen.queryByRole('button', { name: 'Edit Contract' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add Rate/i })).not.toBeInTheDocument()
    expect(screen.getByText(/This contract is expired and read-only\./i)).toBeInTheDocument()
  })
})
