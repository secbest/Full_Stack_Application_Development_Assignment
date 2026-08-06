// Owner: Zheng Bao - the Bookings table's delete action
// (frontend/src/pages/bookings/BookingListPage.jsx).
//
// No other test file exercises BookingListPage yet, so this one is scoped to the new
// feature: the Delete action only appears on Invoiced rows, is confirmed through the
// app's own ConfirmDialog (not a browser window.confirm), and calls
// DELETE /bookings/:id on confirm.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import BookingListPage from '@/pages/bookings/BookingListPage'

function booking(overrides = {}) {
  return {
    id: 9,
    reference_number: 'BKG-2026-00009',
    intake_submission_id: null,
    intake_reference: null,
    client_name: 'Tan Tock Seng Hospital',
    service_type: 'eas',
    service_tier: 'advanced',
    original_service_tier: null,
    scheduled_date: '2026-09-01',
    scheduled_time: '10:00',
    pickup_location: 'A',
    destination: 'B',
    notes: '',
    assigned_crew_name: 'Ravi Kumar',
    created_by: 1,
    created_by_name: 'Camilla Wong',
    status: 'invoiced',
    has_memo: true,
    memo_status: 'invoiced',
    has_invoice: true,
    invoice_status: 'synced_to_xero',
    created_at: '2026-08-01T02:00:00.000Z',
    ...overrides,
  }
}

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
  mock.onGet('/users').reply(200, { success: true, data: [] })
})

afterEach(() => {
  mock.restore()
})

describe('BookingListPage - delete flow', () => {
  test('only Invoiced rows show a Delete action', async () => {
    mock.onGet('/bookings').reply(200, {
      success: true,
      data: {
        data: [
          booking({ id: 9, reference_number: 'BKG-2026-00009', status: 'invoiced' }),
          booking({ id: 10, reference_number: 'BKG-2026-00010', status: 'confirmed' }),
        ],
      },
    })
    render(<BookingListPage />)

    await screen.findByText('BKG-2026-00009')
    expect(screen.getAllByRole('button', { name: /Delete/i })).toHaveLength(1)
  })

  test('clicking Delete opens a confirmation dialog naming the linked records, and Cancel leaves the row intact', async () => {
    const user = userEvent.setup()
    mock.onGet('/bookings').reply(200, { success: true, data: { data: [booking()] } })
    render(<BookingListPage />)

    await screen.findByText('BKG-2026-00009')
    await user.click(screen.getByRole('button', { name: /Delete/i }))

    expect(await screen.findByText('Delete this booking?')).toBeInTheDocument()
    expect(screen.getByText(/Booking BKG-2026-00009 and its service memo, invoice, and job milestones will be permanently deleted/)).toBeInTheDocument()

    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Delete this booking?')).not.toBeInTheDocument()
    expect(mock.history.delete).toHaveLength(0)
    expect(screen.getByText('BKG-2026-00009')).toBeInTheDocument()
  })

  test('confirming the dialog deletes the booking and shows a success notification', async () => {
    const user = userEvent.setup()
    mock.onGet('/bookings').reply(200, { success: true, data: { data: [booking()] } })
    mock.onDelete('/bookings/9').reply(200, { success: true, data: { id: 9, reference_number: 'BKG-2026-00009' } })
    render(<BookingListPage />)

    await screen.findByText('BKG-2026-00009')
    await user.click(screen.getByRole('button', { name: /Delete/i }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mock.history.delete).toHaveLength(1))
    expect(await screen.findByText('Booking BKG-2026-00009 deleted.')).toBeInTheDocument()
    expect(screen.queryByText('Delete this booking?')).not.toBeInTheDocument()
  })

  test('a failed delete request surfaces the backend error message', async () => {
    const user = userEvent.setup()
    mock.onGet('/bookings').reply(200, { success: true, data: { data: [booking()] } })
    mock.onDelete('/bookings/9').reply(409, { success: false, message: 'Only invoiced bookings can be deleted.' })
    render(<BookingListPage />)

    await screen.findByText('BKG-2026-00009')
    await user.click(screen.getByRole('button', { name: /Delete/i }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Only invoiced bookings can be deleted.')).toBeInTheDocument()
  })
})
