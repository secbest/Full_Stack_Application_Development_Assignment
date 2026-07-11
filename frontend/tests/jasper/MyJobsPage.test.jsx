// Owner: Jasper - Field Ops (Wave 2A), hotfix follow-up.
// Regression test for the "Create Memo" button showing on already-completed bookings:
// a booking only ever reaches 'completed' as a side effect of a memo being submitted
// (see backend/src/controllers/serviceMemoController.js's createServiceMemo), so offering
// "Create Memo" again on a 'completed' card let a crew member re-trigger the wizard and
// hit the backend's MEMO_ALREADY_EXISTS guard with no warning. Fixed in MyJobsPage.jsx by
// only showing the create-memo action for 'in_progress' and treating 'completed' the same
// as 'invoiced' - "Memo Submitted", no button.
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import MyJobsPage from '@/pages/jobs/MyJobsPage'

function job(overrides = {}) {
  return {
    id: 1,
    reference_number: 'BKG-TEST-00001',
    client: { id: 1, name: 'Raffles Medical Group' },
    service_type: 'eas',
    service_tier: 'advanced',
    scheduled_date: '2026-07-02',
    scheduled_time: '09:00',
    pickup_location: 'Raffles Hospital',
    destination: 'Tan Tock Seng Hospital A&E',
    status: 'confirmed',
    ...overrides,
  }
}

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
})

afterEach(() => {
  mock.reset()
})

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/jobs']}>
        <Routes>
          <Route path="/jobs" element={<MyJobsPage />} />
          <Route path="/jobs/:bookingId/memo" element={<div>Memo Wizard Stub</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('MyJobsPage - action button per booking status', () => {
  test('confirmed shows a disabled "Start Job" button', async () => {
    mock.onGet('/bookings/my-jobs').reply(200, { success: true, data: [job({ status: 'confirmed' })] })
    renderPage()

    expect(await screen.findByRole('button', { name: 'Start Job' })).toBeDisabled()
  })

  test('in_progress shows an enabled "Start Job & Create Memo" button', async () => {
    mock.onGet('/bookings/my-jobs').reply(200, { success: true, data: [job({ status: 'in_progress' })] })
    renderPage()

    expect(await screen.findByRole('button', { name: 'Start Job & Create Memo' })).toBeEnabled()
  })

  // Regression: completed used to also show "Create Memo", letting a crew member
  // re-open the wizard on a booking that already has a memo and hit MEMO_ALREADY_EXISTS.
  test('completed shows "Memo Submitted" with no button to re-open the wizard', async () => {
    mock.onGet('/bookings/my-jobs').reply(200, { success: true, data: [job({ status: 'completed' })] })
    renderPage()

    expect(await screen.findByText('Memo Submitted')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create Memo/i })).not.toBeInTheDocument()
  })

  test('invoiced also shows "Memo Submitted" with no button', async () => {
    mock.onGet('/bookings/my-jobs').reply(200, { success: true, data: [job({ status: 'invoiced' })] })
    renderPage()

    expect(await screen.findByText('Memo Submitted')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create Memo/i })).not.toBeInTheDocument()
  })
})
