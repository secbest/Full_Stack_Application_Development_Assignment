// Owner: Zheng Bao - the public, unauthenticated intake portal (UC-01,
// frontend/src/pages/intake/PublicIntakeFormPage.jsx).
//
// jasper/PublicIntakeFormPage.test.jsx already covers autofill attributes, the
// full EAS/MTS labels, and that the tier field is intentionally absent from the
// customer-facing form. This file covers the rest of the page: client-side
// validation feedback, the duplicate-submission server response, and the
// success confirmation screen.
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PublicIntakeFormPage from '@/pages/intake/PublicIntakeFormPage'
import { submitIntake } from '@/api/intake'

jest.mock('@/api/intake', () => ({ submitIntake: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
})

async function fillValidForm(user) {
  fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'John Tan' } })
  fireEvent.change(screen.getByLabelText(/Contact Email/i), { target: { value: 'john@example.com' } })
  fireEvent.change(screen.getByLabelText(/Contact Phone/i), { target: { value: '91234567' } })
  await user.click(screen.getByRole('combobox', { name: /Service Type/i }))
  await user.click(within(await screen.findByRole('listbox')).getByText('Emergency Ambulance Services (EAS)'))
  fireEvent.change(screen.getByLabelText(/Preferred Date/i), { target: { value: '2099-09-01' } })
  fireEvent.change(screen.getByLabelText(/Preferred Time/i), { target: { value: '10:00' } })
  fireEvent.change(screen.getByLabelText(/Pickup Location/i), { target: { value: 'Changi General Hospital' } })
  fireEvent.change(screen.getByLabelText(/Destination/i), { target: { value: 'Singapore General Hospital' } })
}

describe('PublicIntakeFormPage - client-side validation', () => {
  test('submitting a blank form shows a required-field error per field and never calls the API', async () => {
    const user = userEvent.setup()
    render(<PublicIntakeFormPage />)

    await user.click(screen.getByRole('button', { name: /Submit Request/i }))

    expect(await screen.findByText('Full name is required')).toBeInTheDocument()
    expect(screen.getByText('Contact email is required')).toBeInTheDocument()
    expect(screen.getByText('Contact phone is required')).toBeInTheDocument()
    expect(screen.getByText('Service type is required')).toBeInTheDocument()
    expect(screen.getByText('Pickup location is required')).toBeInTheDocument()
    expect(screen.getByText('Destination is required')).toBeInTheDocument()
    expect(submitIntake).not.toHaveBeenCalled()
  })

  test('rejects a phone number that is not exactly 8 digits', async () => {
    const user = userEvent.setup()
    render(<PublicIntakeFormPage />)

    fireEvent.change(screen.getByLabelText(/Contact Phone/i), { target: { value: '12345' } })
    await user.click(screen.getByRole('button', { name: /Submit Request/i }))

    expect(await screen.findByText('Enter an 8-digit Singapore phone number')).toBeInTheDocument()
    expect(submitIntake).not.toHaveBeenCalled()
  })

  // Checked via blur, not a submit click: the input is type="email", so an invalid format
  // trips the browser's own HTML5 constraint validation on submit and blocks the form's
  // submit event before Formik/Yup ever runs - blurring the field is what actually surfaces
  // this app's own styled Yup error message instead of a native browser tooltip.
  test('rejects an invalid email address on blur', async () => {
    render(<PublicIntakeFormPage />)

    const emailInput = screen.getByLabelText(/Contact Email/i)
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } })
    fireEvent.blur(emailInput)

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(submitIntake).not.toHaveBeenCalled()
  })
})

describe('PublicIntakeFormPage - server responses', () => {
  test('duplicate submission (409): shows the backend message and keeps the form on screen', async () => {
    const user = userEvent.setup()
    submitIntake.mockRejectedValue({
      response: { data: { code: 'DUPLICATE_SUBMISSION', message: 'A similar intake submission was received recently.' } },
    })
    render(<PublicIntakeFormPage />)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /Submit Request/i }))

    expect(await screen.findByText(/A similar intake submission was received recently\./i)).toBeInTheDocument()
    // Still on the form, not the "Request Received" confirmation screen.
    expect(screen.getByRole('button', { name: /Submit Request/i })).toBeInTheDocument()
  })

  test('generic server error falls back to a friendly message when the response has none', async () => {
    const user = userEvent.setup()
    submitIntake.mockRejectedValue({ response: { data: {} } })
    render(<PublicIntakeFormPage />)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /Submit Request/i }))

    expect(await screen.findByText('We could not submit your request. Please check the form and try again.')).toBeInTheDocument()
  })

  test('successful submission replaces the form with the reference-number confirmation screen', async () => {
    const user = userEvent.setup()
    submitIntake.mockResolvedValue({
      reference_number: 'EFAR-2026-00001',
      message: 'Your request has been received. Our team will be in touch shortly.',
    })
    render(<PublicIntakeFormPage />)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /Submit Request/i }))

    expect(await screen.findByText('Request Received')).toBeInTheDocument()
    expect(screen.getByText('EFAR-2026-00001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Submit Request/i })).not.toBeInTheDocument()
  })
})
