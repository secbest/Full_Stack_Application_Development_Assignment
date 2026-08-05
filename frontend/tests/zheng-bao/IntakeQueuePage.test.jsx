// Owner: Zheng Bao - the internal Intake Queue review screen
// (frontend/src/pages/bookings/IntakeQueuePage.jsx).
//
// jasper/IntakeQueueTier.test.jsx already covers the service-tier assignment
// flow on confirm. This file covers the rest of the page: the search/reference
// filter, the reject flow (client-side reason validation + the reject request),
// the delete flow (only offered on rejected rows, confirmed via the app's own
// ConfirmDialog rather than a browser window.confirm), and the failed-fetch error toast.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import IntakeQueuePage from '@/pages/bookings/IntakeQueuePage'

function intake(overrides = {}) {
  return {
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
    ...overrides,
  }
}

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
})

afterEach(() => {
  mock.restore()
})

describe('IntakeQueuePage - search and filtering', () => {
  test('search narrows the table to rows matching name, reference, or organisation', async () => {
    const user = userEvent.setup()
    mock.onGet('/intake').reply(200, {
      success: true,
      data: {
        data: [
          intake({ id: 41, reference_number: 'EFAR-2026-00041', customer_name: 'John Tan', organisation: 'Changi General Hospital' }),
          intake({ id: 42, reference_number: 'EFAR-2026-00042', customer_name: 'Mary Lim', organisation: 'Tan Tock Seng Hospital' }),
        ],
      },
    })
    render(<IntakeQueuePage />)

    await screen.findByText('EFAR-2026-00041')
    expect(screen.getByText('EFAR-2026-00042')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/Search by name, reference, or organisation/i), 'Mary')

    expect(screen.queryByText('EFAR-2026-00041')).not.toBeInTheDocument()
    expect(screen.getByText('EFAR-2026-00042')).toBeInTheDocument()
  })

  test('a search term matching no submission shows the empty-state row', async () => {
    const user = userEvent.setup()
    mock.onGet('/intake').reply(200, { success: true, data: { data: [intake()] } })
    render(<IntakeQueuePage />)

    await screen.findByText('EFAR-2026-00041')
    await user.type(screen.getByPlaceholderText(/Search by name, reference, or organisation/i), 'nonexistent-reference')

    expect(await screen.findByText('No intake submissions found.')).toBeInTheDocument()
  })

  test('the Rejected filter pill hides pending/confirmed rows', async () => {
    const user = userEvent.setup()
    mock.onGet('/intake').reply(200, {
      success: true,
      data: {
        data: [
          intake({ id: 41, reference_number: 'EFAR-2026-00041', status: 'pending' }),
          intake({ id: 43, reference_number: 'EFAR-2026-00043', status: 'rejected' }),
        ],
      },
    })
    render(<IntakeQueuePage />)

    await screen.findByText('EFAR-2026-00041')
    await user.click(screen.getByRole('button', { name: /^Rejected$/i }))

    expect(screen.queryByText('EFAR-2026-00041')).not.toBeInTheDocument()
    expect(screen.getByText('EFAR-2026-00043')).toBeInTheDocument()
  })
})

describe('IntakeQueuePage - reject flow', () => {
  test('rejecting without a reason shows a validation error and never calls the API', async () => {
    const user = userEvent.setup()
    mock.onGet('/intake').reply(200, { success: true, data: { data: [intake()] } })
    render(<IntakeQueuePage />)

    await screen.findByText('EFAR-2026-00041')
    await user.click(screen.getByRole('button', { name: /^Review$/i }))
    await user.click(screen.getByRole('button', { name: /Reject Submission/i }))

    expect(await screen.findByText('Please enter a rejection reason')).toBeInTheDocument()
    expect(mock.history.post).toHaveLength(0)
  })

  test('rejecting with a reason posts it and shows a success toast', async () => {
    const user = userEvent.setup()
    mock.onGet('/intake').reply(200, { success: true, data: { data: [intake()] } })
    mock.onPost('/intake/41/reject').reply(200, { success: true, data: { id: 41, status: 'rejected' } })
    render(<IntakeQueuePage />)

    await screen.findByText('EFAR-2026-00041')
    await user.click(screen.getByRole('button', { name: /^Review$/i }))
    fireEvent.change(screen.getByPlaceholderText(/Required if rejecting this submission/i), { target: { value: 'Outside service area' } })
    await user.click(screen.getByRole('button', { name: /Reject Submission/i }))

    await waitFor(() => expect(mock.history.post).toHaveLength(1))
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({ rejection_reason: 'Outside service area' })
    expect(await screen.findByText('Submission EFAR-2026-00041 rejected.')).toBeInTheDocument()
  })

  test('a failed reject request surfaces the backend error message in the toast', async () => {
    const user = userEvent.setup()
    mock.onGet('/intake').reply(200, { success: true, data: { data: [intake()] } })
    mock.onPost('/intake/41/reject').reply(409, { success: false, message: 'Intake has already been actioned.' })
    render(<IntakeQueuePage />)

    await screen.findByText('EFAR-2026-00041')
    await user.click(screen.getByRole('button', { name: /^Review$/i }))
    fireEvent.change(screen.getByPlaceholderText(/Required if rejecting this submission/i), { target: { value: 'Outside service area' } })
    await user.click(screen.getByRole('button', { name: /Reject Submission/i }))

    expect(await screen.findByText('Intake has already been actioned.')).toBeInTheDocument()
  })
})

describe('IntakeQueuePage - delete flow', () => {
  test('only rejected rows show a Delete action', async () => {
    mock.onGet('/intake').reply(200, {
      success: true,
      data: {
        data: [
          intake({ id: 41, reference_number: 'EFAR-2026-00041', status: 'pending' }),
          intake({ id: 43, reference_number: 'EFAR-2026-00043', status: 'rejected' }),
        ],
      },
    })
    render(<IntakeQueuePage />)

    await screen.findByText('EFAR-2026-00041')
    expect(screen.getAllByRole('button', { name: /Delete/i })).toHaveLength(1)
  })

  test('clicking Delete opens a confirmation dialog, not a browser prompt, and Cancel leaves the row intact', async () => {
    const user = userEvent.setup()
    mock.onGet('/intake').reply(200, { success: true, data: { data: [intake({ status: 'rejected' })] } })
    render(<IntakeQueuePage />)

    await screen.findByText('EFAR-2026-00041')
    await user.click(screen.getByRole('button', { name: /Delete/i }))

    expect(await screen.findByText('Delete this submission?')).toBeInTheDocument()
    expect(screen.getByText(/Submission EFAR-2026-00041 will be permanently deleted/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Delete this submission?')).not.toBeInTheDocument()
    expect(mock.history.delete).toHaveLength(0)
    expect(screen.getByText('EFAR-2026-00041')).toBeInTheDocument()
  })

  test('confirming the dialog deletes the submission and shows a success toast', async () => {
    const user = userEvent.setup()
    mock.onGet('/intake').reply(200, { success: true, data: { data: [intake({ status: 'rejected' })] } })
    mock.onDelete('/intake/41').reply(200, { success: true, data: { id: 41, reference_number: 'EFAR-2026-00041' } })
    render(<IntakeQueuePage />)

    await screen.findByText('EFAR-2026-00041')
    await user.click(screen.getByRole('button', { name: /Delete/i }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mock.history.delete).toHaveLength(1))
    expect(await screen.findByText('Submission EFAR-2026-00041 deleted.')).toBeInTheDocument()
    expect(screen.queryByText('Delete this submission?')).not.toBeInTheDocument()
  })

  test('a failed delete request surfaces the backend error message in the toast', async () => {
    const user = userEvent.setup()
    mock.onGet('/intake').reply(200, { success: true, data: { data: [intake({ status: 'rejected' })] } })
    mock.onDelete('/intake/41').reply(409, { success: false, message: 'Only rejected intake submissions can be deleted.' })
    render(<IntakeQueuePage />)

    await screen.findByText('EFAR-2026-00041')
    await user.click(screen.getByRole('button', { name: /Delete/i }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Only rejected intake submissions can be deleted.')).toBeInTheDocument()
  })
})

describe('IntakeQueuePage - fetch failure', () => {
  test('shows an error toast and an empty table when the intake queue fails to load', async () => {
    mock.onGet('/intake').reply(500)
    render(<IntakeQueuePage />)

    expect(await screen.findByText('Failed to load intake queue. Please refresh.')).toBeInTheDocument()
    expect(screen.getByText('No intake submissions found.')).toBeInTheDocument()
  })
})
