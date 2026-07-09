// Owner: Jasper - Wave 2B (Pricing Contracts).
//
// There is no POST /api/orders anywhere in this app (see design/jasper/api-documentation.md) -
// the closest real equivalent is POST /api/contracts, submitted from ContractFormPage
// (src/pages/invoices/ContractFormPage.jsx, screen 13 "Create/Edit Contract Form", UC-01).
// These tests exercise that exact create flow using axios-mock-adapter against the shared
// `api` axios instance (src/api/index.js), the same instance every api/*.js helper uses.
//
// Note on the "validation error" scenario: ContractFormPage's handleSubmitError() only
// ever shows backend field errors inside a single toast (it never calls
// formik.setErrors()) - see the code comment directly above handleSubmitError in that
// file. So a mocked 400 with an `errors[]` array surfaces as toast text, not inline text
// under each <Input>. Inline per-field text under the inputs (via FieldError.jsx) only
// happens for the form's own client-side Yup validation (createContractSchema), which is
// covered separately below since it never reaches the network at all.
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import ContractFormPage from '@/pages/invoices/ContractFormPage'

const SAMPLE_CLIENT = { id: 1, name: 'Tan Tock Seng Hospital' }

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
  // Every mode of the form loads the client dropdown on mount (see ContractFormPage's
  // useEffect) - mocked here once so each test only needs to add its own POST handler.
  mock.onGet('/clients').reply(200, { success: true, data: [SAMPLE_CLIENT] })
})

afterEach(() => {
  mock.reset()
})

function renderNewContractForm() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/pricing-contracts/new']}>
        <Routes>
          <Route path="/pricing-contracts/new" element={<ContractFormPage />} />
          {/* Stub destination for the post-create navigate() call - proves the redirect
              actually fired without needing to mock react-router-dom itself. */}
          <Route path="/pricing-contracts/:id" element={<div>Contract Detail Stub</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

async function fillRequiredFields(user) {
  await user.type(screen.getByLabelText(/Contract Name/i), 'REST Client Test Contract - FY2027')

  await user.click(screen.getByRole('combobox', { name: /Client/i }))
  // Radix also renders a visually-hidden native <select><option> in parallel (for
  // autofill/native form semantics), which duplicates the client name as plain text -
  // scoping to the open listbox avoids matching that hidden copy as well.
  const listbox = await screen.findByRole('listbox')
  await user.click(within(listbox).getByText(SAMPLE_CLIENT.name))

  // Native <input type="date"> - userEvent.type() doesn't reliably drive date inputs
  // across browsers/jsdom, so these two are set directly via fireEvent.change().
  fireEvent.change(screen.getByLabelText(/Effective From/i), { target: { value: '2027-01-01' } })
  fireEvent.change(screen.getByLabelText(/Effective To/i), { target: { value: '2027-12-31' } })
}

function getSaveButton() {
  return screen.getByRole('button', { name: /Save Contract/i })
}

describe('ContractFormPage - create contract (POST /api/contracts via axios-mock-adapter)', () => {
  test('successful create: 201 response shows a success toast and navigates to the new contract', async () => {
    const user = userEvent.setup()
    mock.onPost('/contracts').reply(201, {
      success: true,
      data: { id: 42, contract_name: 'REST Client Test Contract - FY2027', warning: null },
    })

    renderNewContractForm()
    await fillRequiredFields(user)
    await user.click(getSaveButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Contract created successfully.')
    expect(await screen.findByText('Contract Detail Stub')).toBeInTheDocument()

    expect(mock.history.post).toHaveLength(1)
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({
      client_id: SAMPLE_CLIENT.id,
      contract_name: 'REST Client Test Contract - FY2027',
      effective_from: '2027-01-01',
      effective_to: '2027-12-31',
    })
  })

  test('successful create with a warning: toast includes the backend warning text, not a plain success message', async () => {
    const user = userEvent.setup()
    mock.onPost('/contracts').reply(201, {
      success: true,
      data: { id: 43, warning: 'No pricing rules attached - jobs for this client will not auto-match yet.' },
    })

    renderNewContractForm()
    await fillRequiredFields(user)
    await user.click(getSaveButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Contract created.')
    expect(alert).toHaveTextContent('No pricing rules attached')
  })

  test('server error: 500 response shows the backend message as an error toast and keeps the form on screen', async () => {
    const user = userEvent.setup()
    mock.onPost('/contracts').reply(500, {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error. Please try again later.',
    })

    renderNewContractForm()
    await fillRequiredFields(user)
    await user.click(getSaveButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Internal server error. Please try again later.')
    // No navigation happened - the form (and its Save button) is still on screen.
    expect(getSaveButton()).toBeInTheDocument()
  })

  test('server error: 500 with no message body falls back to the generic save-failure toast', async () => {
    const user = userEvent.setup()
    mock.onPost('/contracts').reply(500)

    renderNewContractForm()
    await fillRequiredFields(user)
    await user.click(getSaveButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Failed to save contract. Please try again.')
  })

  test('validation error: 400 with field errors joins every field message into the error toast', async () => {
    const user = userEvent.setup()
    mock.onPost('/contracts').reply(400, {
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'One or more fields failed validation.',
      errors: [
        { field: 'contract_name', message: 'Contract name is required' },
        { field: 'effective_to', message: 'Effective to must be on or after effective from' },
      ],
    })

    renderNewContractForm()
    await fillRequiredFields(user)
    await user.click(getSaveButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('contract_name: Contract name is required')
    expect(alert).toHaveTextContent('effective_to: Effective to must be on or after effective from')
    // Confirms this is the 400 path, not a silent success - still on the form.
    expect(getSaveButton()).toBeInTheDocument()
  })

  test('conflict error: 409 CONTRACT_OVERLAP shows the backend message as an error toast', async () => {
    const user = userEvent.setup()
    mock.onPost('/contracts').reply(409, {
      success: false,
      code: 'CONTRACT_OVERLAP',
      message: 'An active contract already exists for this client. Please set an end date on the existing contract before creating a new one.',
    })

    renderNewContractForm()
    await fillRequiredFields(user)
    await user.click(getSaveButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('An active contract already exists for this client.')
  })
})

describe('ContractFormPage - client-side validation (Formik/Yup, no network call)', () => {
  test('submitting with every required field empty shows inline errors and never calls the API', async () => {
    const user = userEvent.setup()
    renderNewContractForm()
    // Client dropdown finishes loading before the user interacts with the form.
    await screen.findByRole('combobox', { name: /Client/i })

    await user.click(getSaveButton())

    expect(await screen.findByText('Contract name is required')).toBeInTheDocument()
    expect(screen.getByText('Effective from date is required')).toBeInTheDocument()
    expect(screen.getByText('Effective to date is required')).toBeInTheDocument()

    // Formik's own validation blocked the submit handler before onSubmit ever ran, so
    // no POST /contracts request should have gone out at all.
    expect(mock.history.post).toHaveLength(0)
  })
})

describe('ContractFormPage - edit contract (PATCH /api/contracts/:id, UC-02)', () => {
  const EXISTING_CONTRACT = {
    id: 7,
    client_id: SAMPLE_CLIENT.id,
    contract_name: 'TTSH - FY2027 Service Agreement',
    effective_from: '2027-01-01',
    effective_to: '2027-12-31',
  }

  function renderEditContractForm(id = 7) {
    return render(
      <ToastProvider>
        <MemoryRouter initialEntries={[`/pricing-contracts/${id}/edit`]}>
          <Routes>
            <Route path="/pricing-contracts/:id/edit" element={<ContractFormPage />} />
            <Route path="/pricing-contracts/:id" element={<div>Contract Detail Stub</div>} />
            <Route path="/pricing-contracts" element={<div>Pricing Contracts List Stub</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    )
  }

  test('loads the existing contract into the form, with no client picker or rates/surcharges cards', async () => {
    mock.onGet('/contracts/7').reply(200, { success: true, data: EXISTING_CONTRACT })

    renderEditContractForm()

    expect(await screen.findByDisplayValue('TTSH - FY2027 Service Agreement')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Edit Contract' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Client/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Initial Pricing Rates')).not.toBeInTheDocument()
    expect(screen.queryByText('Surcharge Schedule')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })

  test('shows "Contract not found." and an error toast when the contract fails to load', async () => {
    mock.onGet('/contracts/999').reply(404, { success: false, code: 'CONTRACT_NOT_FOUND', message: 'No contract with this id.' })

    renderEditContractForm(999)

    expect(await screen.findByText('Contract not found.')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load contract.')
  })

  test('successful update: 200 shows a success toast and navigates to the contract detail page', async () => {
    const user = userEvent.setup()
    mock.onGet('/contracts/7').reply(200, { success: true, data: EXISTING_CONTRACT })
    mock.onPatch('/contracts/7').reply(200, { success: true, data: { id: 7, contract_name: 'TTSH - Renamed' } })

    renderEditContractForm()
    const nameInput = await screen.findByDisplayValue('TTSH - FY2027 Service Agreement')
    await user.clear(nameInput)
    await user.type(nameInput, 'TTSH - Renamed')

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Contract updated successfully.')
    expect(await screen.findByText('Contract Detail Stub')).toBeInTheDocument()
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({
      contract_name: 'TTSH - Renamed', effective_from: '2027-01-01', effective_to: '2027-12-31',
    })
  })

  test('HAS_MATCHED_INVOICES: accepting the confirm resubmits with acknowledge_matched_invoices=true', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    mock.onGet('/contracts/7').reply(200, { success: true, data: EXISTING_CONTRACT })
    let patchCall = 0
    mock.onPatch('/contracts/7').reply(() => {
      patchCall += 1
      if (patchCall === 1) {
        return [400, { success: false, code: 'HAS_MATCHED_INVOICES', message: '3 invoice(s) have already been matched using this contract.' }]
      }
      return [200, { success: true, data: { id: 7 } }]
    })

    renderEditContractForm()
    await screen.findByDisplayValue('TTSH - FY2027 Service Agreement')

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('3 invoice(s) have already been matched'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Contract updated successfully.')
    expect(mock.history.patch).toHaveLength(2)
    expect(JSON.parse(mock.history.patch[1].data)).toMatchObject({ acknowledge_matched_invoices: true })

    confirmSpy.mockRestore()
  })

  test('HAS_MATCHED_INVOICES: declining the confirm sends no second request and stays on the form', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    mock.onGet('/contracts/7').reply(200, { success: true, data: EXISTING_CONTRACT })
    mock.onPatch('/contracts/7').reply(400, { success: false, code: 'HAS_MATCHED_INVOICES', message: '3 invoice(s) have already been matched using this contract.' })

    renderEditContractForm()
    await screen.findByDisplayValue('TTSH - FY2027 Service Agreement')

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await screen.findByRole('button', { name: 'Save Changes' }) // still on the form
    expect(mock.history.patch).toHaveLength(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })
})
