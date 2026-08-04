// Owner: Jasper - Field Ops (client feedback items 1 + 4, interim review 17 Jul 2026).
// Two wizard changes are covered here:
//   item 1 - Step 1 pre-fills job start/end from the milestones the crew already
//            tapped live, so they are not re-typing times they have already recorded
//   item 4 - a manpower-only standby booking (no ambulance, no patient) must be able
//            to reach the end of the wizard with the patient fields left blank
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import MemoWizardPage from '@/pages/jobs/memo-wizard/MemoWizardPage'

function booking(overrides = {}) {
  return {
    id: 1,
    reference_number: 'BKG-TEST-00005',
    client: { id: 1, name: 'Raffles Medical Group' },
    service_type: 'event_standby',
    service_tier: 'basic',
    scheduled_date: '2026-08-04',
    scheduled_time: '08:00',
    pickup_location: 'Singapore Sports Hub',
    destination: 'Singapore Sports Hub',
    status: 'in_progress',
    milestones: [],
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

function renderWizard() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/jobs/1/memo']}>
        <Routes>
          <Route path="/jobs/:bookingId/memo" element={<MemoWizardPage />} />
          <Route path="/jobs" element={<div>My Jobs Stub</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('Memo wizard Step 1 - milestone pre-fill (client feedback #1)', () => {
  test('job start and end are pre-filled from the recorded activated/job_completed milestones', async () => {
    mock.onGet('/bookings/1').reply(200, {
      success: true,
      data: booking({
        milestones: [
          { milestone_type: 'activated', recorded_at: '2026-08-04T00:30:00.000Z' },
          { milestone_type: 'job_completed', recorded_at: '2026-08-04T03:15:00.000Z' },
        ],
      }),
    })
    renderWizard()

    const start = await screen.findByLabelText(/Job Start Time/i)
    const end = screen.getByLabelText(/Job End Time/i)

    // datetime-local inputs hold LOCAL time, so build the expected strings the same
    // way rather than hard-coding a timezone-specific literal.
    const toLocal = (iso) => {
      const d = new Date(iso)
      const p = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
    }
    expect(start).toHaveValue(toLocal('2026-08-04T00:30:00.000Z'))
    expect(end).toHaveValue(toLocal('2026-08-04T03:15:00.000Z'))
  })

  test('with no milestones recorded the time fields start empty', async () => {
    mock.onGet('/bookings/1').reply(200, { success: true, data: booking({ milestones: [] }) })
    renderWizard()

    expect(await screen.findByLabelText(/Job Start Time/i)).toHaveValue('')
    expect(screen.getByLabelText(/Job End Time/i)).toHaveValue('')
  })
})

describe('Memo wizard - manpower-only standby job (client feedback #4)', () => {
  test('an event_standby booking marks the patient fields optional and advances with them blank', async () => {
    const user = userEvent.setup()
    mock.onGet('/bookings/1').reply(200, {
      success: true,
      data: booking({
        service_type: 'event_standby',
        milestones: [
          { milestone_type: 'activated', recorded_at: '2026-08-04T00:30:00.000Z' },
          { milestone_type: 'job_completed', recorded_at: '2026-08-04T03:15:00.000Z' },
        ],
      }),
    })
    renderWizard()

    // The labels say "optional" for a manpower-only job, and the hint explains why.
    expect(await screen.findByLabelText(/Patient Name \(optional/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Hospital Destination \(optional/i)).toBeInTheDocument()
    expect(screen.getByText(/no patient/i)).toBeInTheDocument()

    // Times are pre-filled from milestones, so Step 1 is already submittable.
    await user.click(screen.getByRole('button', { name: /Next: Service & Charges/i }))

    // Reaching Step 2 with both patient fields blank is the whole point of item 4.
    expect(await screen.findByText('Service Details')).toBeInTheDocument()
  })

  test('an eas booking keeps the patient fields required and blocks Step 1 when blank', async () => {
    const user = userEvent.setup()
    mock.onGet('/bookings/1').reply(200, {
      success: true,
      data: booking({
        service_type: 'eas',
        destination: '', // so hospital_destination does not auto-fill from the booking
        milestones: [
          { milestone_type: 'activated', recorded_at: '2026-08-04T00:30:00.000Z' },
          { milestone_type: 'job_completed', recorded_at: '2026-08-04T03:15:00.000Z' },
        ],
      }),
    })
    renderWizard()

    expect(await screen.findByLabelText(/Patient Name/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Patient Name \(optional/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Next: Service & Charges/i }))

    expect(await screen.findByText('Patient name is required')).toBeInTheDocument()
    expect(screen.queryByText('Service Details')).not.toBeInTheDocument()
  })

  test('Step 2 defaults the service type to the booking\'s own type', async () => {
    const user = userEvent.setup()
    mock.onGet('/bookings/1').reply(200, {
      success: true,
      data: booking({
        service_type: 'event_standby',
        milestones: [
          { milestone_type: 'activated', recorded_at: '2026-08-04T00:30:00.000Z' },
          { milestone_type: 'job_completed', recorded_at: '2026-08-04T03:15:00.000Z' },
        ],
      }),
    })
    renderWizard()

    await screen.findByLabelText(/Patient Name \(optional/i)
    await user.click(screen.getByRole('button', { name: /Next: Service & Charges/i }))

    await screen.findByText('Service Details')
    // The booking already states the service type - the crew should not have to
    // re-select it (and a mismatch would break the pricing match downstream).
    // shadcn's Select renders BOTH a display span and a hidden native <select>, so
    // assert on the native option's selected state rather than the ambiguous label text.
    await waitFor(() => {
      const selectedOption = document.querySelector('option[value="event_standby"]')
      expect(selectedOption).toBeTruthy()
      expect(selectedOption.selected).toBe(true)
    })
  })
})
