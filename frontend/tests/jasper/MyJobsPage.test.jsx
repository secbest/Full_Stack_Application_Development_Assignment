// Owner: Jasper - Field Ops (client feedback items 1 + 3, interim review 17 Jul 2026).
// My Jobs now leads with a single "Current Job" hero card carrying the live milestone
// stepper ("could it be the case that they are going to do at that present moment,
// rather than the whole lot list?"), with every other job demoted below under an
// always-visible "Upcoming jobs" section (no collapse - an earlier collapsed version
// hid the date tabs and job list behind an extra tap). These tests cover:
//   - hero selection: in_progress wins; a confirmed job today within the next hour
//     (the call centre posts a case about an hour ahead) becomes the hero; otherwise
//     there is no hero and the upcoming list is what's shown instead
//   - the milestone stepper: recorded steps show a timestamp, the next step is a
//     single tap target that POSTs /bookings/:id/milestone and re-renders from the
//     response (client feedback item 1)
//   - completed/invoiced jobs never become the hero and never appear in Upcoming
//     jobs (their memo is already submitted - that belongs in Memo History)
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import MyJobsPage from '@/pages/jobs/MyJobsPage'

function localDateStr(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function localTimeStr(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

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

describe('MyJobsPage - current-job hero selection (client feedback #3)', () => {
  test('an in_progress job renders as the Current Job hero with the milestone stepper', async () => {
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [job({ status: 'in_progress', milestones: [{ milestone_type: 'activated', recorded_at: '2026-07-02T00:45:00Z' }] })],
    })
    renderPage()

    const hero = await screen.findByTestId('current-job-hero')
    expect(within(hero).getByText('Raffles Medical Group')).toBeInTheDocument()
    // 'activated' is recorded, so the single tap target is the NEXT milestone
    expect(within(hero).getByRole('button', { name: 'Arrived at Location' })).toBeEnabled()
    // later milestones are visible but not tappable
    expect(within(hero).queryByRole('button', { name: 'On the way' })).not.toBeInTheDocument()
    expect(within(hero).getByText('On the way')).toBeInTheDocument()
  })

  test('a confirmed job today starting within the next hour becomes the hero, offering "Start Job"', async () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000)
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [job({ status: 'confirmed', scheduled_date: localDateStr(soon), scheduled_time: localTimeStr(soon) })],
    })
    renderPage()

    const hero = await screen.findByTestId('current-job-hero')
    expect(within(hero).getByRole('button', { name: 'Start Job' })).toBeEnabled()
  })

  test('with no in_progress job and nothing inside the window there is no hero, and Upcoming jobs is still visible', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [job({ status: 'confirmed', scheduled_date: localDateStr(tomorrow), scheduled_time: '09:00' })],
    })
    renderPage()

    expect(await screen.findByText(/No active job right now/i)).toBeInTheDocument()
    expect(screen.getByText('Raffles Medical Group')).toBeInTheDocument()
  })

  // Regression: "Upcoming jobs" used to list every booking ever assigned to the crew
  // member with no status filter, so finished jobs (already memo'd, already invoiced)
  // piled up there too - e.g. 11 of 13 rows in a real account were done jobs with
  // nothing left to do. That's what Memo History is for; completed/invoiced bookings
  // are excluded here entirely rather than shown a second time under a misleading
  // "upcoming" label.
  test('completed and invoiced jobs never become the hero and never appear in Upcoming jobs either', async () => {
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [job({ status: 'completed' }), job({ id: 2, reference_number: 'BKG-TEST-00002', status: 'invoiced' })],
    })
    renderPage()

    expect(await screen.findByText(/No active job right now/i)).toBeInTheDocument()
    expect(screen.queryByTestId('current-job-hero')).not.toBeInTheDocument()
    expect(screen.getByText('Upcoming jobs (0)')).toBeInTheDocument()
    expect(screen.queryByText('Memo Submitted')).not.toBeInTheDocument()
    expect(screen.queryByText('Raffles Medical Group')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create Memo/i })).not.toBeInTheDocument()
  })

  test('a confirmed job and an in_progress job both still count toward Upcoming jobs when they are not the hero', async () => {
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [
        job({ id: 1, status: 'in_progress' }), // becomes the hero
        job({ id: 2, reference_number: 'BKG-TEST-00002', status: 'confirmed', client: { id: 2, name: 'ABC Corporation' } }),
        job({ id: 3, reference_number: 'BKG-TEST-00003', status: 'completed', client: { id: 3, name: 'Should Not Appear' } }),
      ],
    })
    renderPage()

    await screen.findByTestId('current-job-hero')
    expect(screen.getByText('Upcoming jobs (1)')).toBeInTheDocument()
    expect(screen.queryByText('Should Not Appear')).not.toBeInTheDocument()
  })

  // Regression: with two in_progress jobs, the hero used to be whichever one
  // happened to come first in the API response - in practice always the same stale
  // demo/seed booking that never gets its memo submitted. That let the "Current Job"
  // card sit on old sample data forever, no matter what the crew actually started
  // next. The hero must instead track the job most recently activated, so tapping
  // "Start Job" on a newly assigned booking is what makes IT the live current job.
  test('when two jobs are in_progress, the one most recently started (not the first in the list) is the hero', async () => {
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [
        job({
          id: 1,
          status: 'in_progress',
          milestones: [{ milestone_type: 'activated', recorded_at: '2026-08-04T09:00:00Z' }],
        }), // started first - now stale
        job({
          id: 2,
          reference_number: 'BKG-TEST-00002',
          client: { id: 2, name: 'ABC Corporation' },
          status: 'in_progress',
          milestones: [{ milestone_type: 'activated', recorded_at: '2026-08-06T02:00:00Z' }],
        }), // started later - this is the live job now
      ],
    })
    renderPage()

    const hero = await screen.findByTestId('current-job-hero')
    expect(within(hero).getByText('ABC Corporation')).toBeInTheDocument()
    expect(screen.getByText('Upcoming jobs (1)')).toBeInTheDocument()
    expect(screen.getByText('Raffles Medical Group')).toBeInTheDocument()
  })
})

describe('MyJobsPage - starting a job that is not the hero', () => {
  // Regression: once ANY job is in_progress, it permanently occupied the single hero
  // slot, so a second confirmed job assigned to the same crew member had no path to
  // "Start Job" at all - it only ever rendered static "Starts at HH:MM" text in its
  // Upcoming jobs row. The backend already allows recording 'activated' on any
  // confirmed booking regardless of hero status, so the action belongs on every
  // confirmed job's card, the same way "Create Memo" already appears on every
  // in_progress job's card and not just the hero's.
  test('a confirmed job demoted to Upcoming (because another job is already in_progress) still offers Start Job, once its own window arrives', async () => {
    const user = userEvent.setup()
    const now = new Date()
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [
        job({ id: 1, status: 'in_progress' }), // occupies the hero slot
        job({
          id: 2,
          reference_number: 'BKG-TEST-00002',
          status: 'confirmed',
          client: { id: 2, name: 'ABC Corporation' },
          scheduled_date: localDateStr(now),
          scheduled_time: localTimeStr(now),
        }),
      ],
    })
    mock.onPost('/bookings/2/milestone').reply(201, {
      success: true,
      data: { booking_id: 2, status: 'in_progress', milestones: [{ milestone_type: 'activated', recorded_at: '2026-07-02T01:00:00Z' }] },
    })
    renderPage()

    await screen.findByTestId('current-job-hero')
    const upcomingRow = screen.getByText('ABC Corporation').closest('.overflow-hidden')
    await user.click(within(upcomingRow).getByRole('button', { name: 'Start Job' }))

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ milestone_type: 'activated' })

    // Tapping "Start Job" is what makes this the live current job (see hero selection
    // regression test below) - it doesn't just flip status in place and stay put.
    const hero = await screen.findByTestId('current-job-hero')
    expect(within(hero).getByText('ABC Corporation')).toBeInTheDocument()
    expect(within(hero).getByRole('button', { name: /Create Memo/i })).toBeEnabled()
  })

  // Regression: "Start Job" was added to every confirmed job's Upcoming card with no
  // time gate at all, so a job scheduled for tomorrow (or any future day) offered the
  // same tappable "Start Job" button as one that's actually due now. A crew shouldn't
  // be able to activate - and rack up billable job-start time against - a booking a
  // full day before it happens. The button must respect the same "due" window the hero
  // card itself uses (today, within the activation window).
  test('a confirmed job scheduled for a future day does not offer Start Job - only its scheduled time', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [
        job({
          status: 'confirmed',
          scheduled_date: localDateStr(tomorrow),
          scheduled_time: '10:00',
        }),
      ],
    })
    renderPage()

    await screen.findByText(/No active job right now/i)
    const upcomingRow = screen.getByText('Raffles Medical Group').closest('.overflow-hidden')
    expect(within(upcomingRow).queryByRole('button', { name: 'Start Job' })).not.toBeInTheDocument()
    expect(within(upcomingRow).getByText(/Starts at 10:00/i)).toBeInTheDocument()
  })
})

describe('MyJobsPage - live milestone stepper (client feedback #1)', () => {
  test('tapping the next milestone POSTs it and re-renders the stepper from the response', async () => {
    const user = userEvent.setup()
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [job({ status: 'in_progress', milestones: [{ milestone_type: 'activated', recorded_at: '2026-07-02T00:45:00Z' }] })],
    })
    mock.onPost('/bookings/1/milestone').reply(201, {
      success: true,
      data: {
        booking_id: 1,
        status: 'in_progress',
        milestones: [
          { milestone_type: 'activated', recorded_at: '2026-07-02T00:45:00Z' },
          { milestone_type: 'arrived_at_location', recorded_at: '2026-07-02T01:10:00Z' },
        ],
      },
    })
    renderPage()

    const hero = await screen.findByTestId('current-job-hero')
    await user.click(within(hero).getByRole('button', { name: 'Arrived at Location' }))

    expect(await within(hero).findByRole('button', { name: 'On the way' })).toBeEnabled()
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ milestone_type: 'arrived_at_location' })
  })

  test('a failed milestone tap shows the backend message and keeps the button tappable', async () => {
    const user = userEvent.setup()
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [job({ status: 'in_progress' })],
    })
    mock.onPost('/bookings/1/milestone').reply(409, {
      success: false, code: 'MILESTONE_ALREADY_RECORDED', message: 'This milestone has already been recorded for this job.',
    })
    renderPage()

    const hero = await screen.findByTestId('current-job-hero')
    await user.click(within(hero).getByRole('button', { name: 'Start Job' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('already been recorded')
    expect(within(hero).getByRole('button', { name: 'Start Job' })).toBeEnabled()
  })
})

describe('MyJobsPage - hero memo action', () => {
  test('once job_completed is recorded the hero leads to the memo wizard', async () => {
    const user = userEvent.setup()
    const allDone = ['activated', 'arrived_at_location', 'en_route', 'arrived_at_destination', 'job_completed']
      .map((t, i) => ({ milestone_type: t, recorded_at: `2026-07-02T0${i}:00:00Z` }))
    mock.onGet('/bookings/my-jobs').reply(200, {
      success: true,
      data: [job({ status: 'in_progress', milestones: allDone })],
    })
    renderPage()

    const hero = await screen.findByTestId('current-job-hero')
    await user.click(within(hero).getByRole('button', { name: /Create Memo/i }))

    expect(await screen.findByText('Memo Wizard Stub')).toBeInTheDocument()
  })
})
