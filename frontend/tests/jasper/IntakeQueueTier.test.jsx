import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import IntakeQueuePage from '@/pages/bookings/IntakeQueuePage'

const INTAKE = {
  id: 41,
  reference_number: 'EFAR-2026-00041',
  created_at: '2026-08-05T02:00:00.000Z',
  customer_name: 'John Tan',
  organisation: 'Changi General Hospital',
  contact_email: 'john@example.com',
  contact_phone: '91234567',
  service_type: 'eas',
  service_tier: null,
  preferred_date: '2026-09-01',
  preferred_time: '10:00',
  pickup_location: 'Changi General Hospital',
  destination: 'Singapore General Hospital',
  additional_notes: '',
  status: 'pending',
}

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
  mock.onGet('/intake').reply(200, { success: true, data: { data: [INTAKE] } })
})

afterEach(() => {
  mock.restore()
})

describe('IntakeQueuePage - quotations owns service-tier selection', () => {
  test('shows an unassessed customer tier and requires quotations to select one', async () => {
    const user = userEvent.setup()
    render(<IntakeQueuePage />)

    expect(await screen.findByText('To be assessed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Review$/i }))

    const tierSelect = screen.getByLabelText(/Service Tier/i)
    expect(tierSelect).toHaveValue('')

    await user.click(screen.getByRole('button', { name: /Confirm Booking/i }))
    expect(await screen.findByText('Select a service tier before confirming the booking.')).toBeInTheDocument()
    expect(mock.history.post).toHaveLength(0)
  })

  test('sends the tier selected by quotations when confirming', async () => {
    const user = userEvent.setup()
    mock.onPost('/intake/41/confirm').reply(201, { success: true, data: { id: 77 } })
    render(<IntakeQueuePage />)

    await screen.findByText('To be assessed')
    await user.click(screen.getByRole('button', { name: /^Review$/i }))
    fireEvent.change(screen.getByLabelText(/Service Tier/i), { target: { value: 'Advanced' } })
    fireEvent.change(screen.getByLabelText(/Pricing Source/i), { target: { value: 'one_off_quote' } })
    fireEvent.change(screen.getByLabelText(/Transfer Type/i), { target: { value: 'one_way_hospital' } })
    fireEvent.change(screen.getByLabelText(/Time Category/i), { target: { value: 'office_hours' } })
    fireEvent.change(screen.getByLabelText(/Agreed Base Price/i), { target: { value: '650.50' } })
    await user.click(screen.getByRole('button', { name: /Confirm Booking/i }))

    await waitFor(() => expect(mock.history.post).toHaveLength(1))
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({
      service_tier: 'advanced',
      pricing_source: 'one_off_quote',
      quoted_transfer_type: 'one_way_hospital',
      quoted_time_of_day: 'office_hours',
      quoted_base_amount: 650.5,
    })
  })
})
