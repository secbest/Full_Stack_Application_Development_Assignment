import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PublicIntakeFormPage from '@/pages/intake/PublicIntakeFormPage'
import { submitIntake } from '@/api/intake'

jest.mock('@/api/intake', () => ({ submitIntake: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  submitIntake.mockResolvedValue({
    reference_number: 'EFAR-2026-00001',
    message: 'Your request has been received.',
  })
})

describe('PublicIntakeFormPage', () => {
  test('offers browser autofill for customer contact details and leaves tier to quotations', () => {
    render(<PublicIntakeFormPage />)

    expect(screen.getByLabelText(/Full Name/i)).toHaveAttribute('autocomplete', 'name')
    expect(screen.getByLabelText(/Organisation/i)).toHaveAttribute('autocomplete', 'organization')
    expect(screen.getByLabelText(/Contact Email/i)).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText(/Contact Phone/i)).toHaveAttribute('autocomplete', 'tel')
    expect(screen.queryByRole('combobox', { name: /Service Tier/i })).not.toBeInTheDocument()
    expect(screen.getByText(/quotations team will assess the appropriate service tier/i)).toBeInTheDocument()
  })

  test('shows the full EAS and MTS names', async () => {
    const user = userEvent.setup()
    render(<PublicIntakeFormPage />)

    await user.click(screen.getByRole('combobox', { name: /Service Type/i }))
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByText('Emergency Ambulance Services (EAS)')).toBeInTheDocument()
    expect(within(listbox).getByText('Medical Transport Services (MTS)')).toBeInTheDocument()
  })

  test('submits the customer request without a service tier', async () => {
    const user = userEvent.setup()
    render(<PublicIntakeFormPage />)

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'John Tan' } })
    fireEvent.change(screen.getByLabelText(/Contact Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/Contact Phone/i), { target: { value: '91234567' } })

    await user.click(screen.getByRole('combobox', { name: /Service Type/i }))
    await user.click(within(await screen.findByRole('listbox')).getByText('Emergency Ambulance Services (EAS)'))

    fireEvent.change(screen.getByLabelText(/Preferred Date/i), { target: { value: '2099-09-01' } })
    fireEvent.change(screen.getByLabelText(/Preferred Time/i), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText(/Pickup Location/i), { target: { value: 'Changi General Hospital' } })
    fireEvent.change(screen.getByLabelText(/Destination/i), { target: { value: 'Singapore General Hospital' } })
    await user.click(screen.getByRole('button', { name: /Submit Request/i }))

    await waitFor(() => expect(submitIntake).toHaveBeenCalledTimes(1))
    expect(submitIntake.mock.calls[0][0]).toMatchObject({
      customer_name: 'John Tan',
      service_type: 'eas',
      pickup_location: 'Changi General Hospital',
      destination: 'Singapore General Hospital',
    })
    expect(submitIntake.mock.calls[0][0]).not.toHaveProperty('service_tier')
  })
})
