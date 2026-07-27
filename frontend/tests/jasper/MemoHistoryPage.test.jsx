// Owner: Jasper - Wave 2A mobile responsiveness.
//
// Memo History showed a 6-column table (Booking / Patient / Destination / Service /
// Status / Submitted). Six columns cannot compress to a 375px viewport, and the two
// alternatives both lose something: horizontal scrolling hides columns behind an
// invisible affordance, and dropping columns silently discards data the crew needs. So
// the page renders a card list below `md` and the original table from `md` up.
//
// These tests assert on which presentation is *rendered*, which is a real decision the
// component makes - not on CSS visibility, which jsdom cannot evaluate.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import MemoHistoryPage from '@/pages/memos/MemoHistoryPage'

const DESKTOP = 1280
const TABLET = 768
const PHONE = 375

function memo(overrides = {}) {
  return {
    id: 41,
    booking_id: 17,
    patient_name: 'Tan Wei Ming',
    hospital_destination: 'Tan Tock Seng Hospital A&E',
    service_type: 'eas',
    status: 'submitted',
    created_at: '2026-07-20T08:15:00.000Z',
    ...overrides,
  }
}

function memoDetail(overrides = {}) {
  return {
    id: 41,
    booking_id: 17,
    job_start_time: '2026-07-20T07:00:00.000Z',
    job_end_time: '2026-07-20T08:00:00.000Z',
    overtime_hours: 0,
    evacuation_floors: 3,
    service_type: 'eas',
    transfer_type: 'one_way_hospital',
    oxygen_litres_used: 2,
    waiting_time_minutes: 15,
    signatures: [{ id: 1, signer_name: 'Nurse Lim', is_waived: false }],
    hospital_stamp_image_url: 'https://example.test/stamp.png',
    ...overrides,
  }
}

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
  mock.onGet('/service-memos').reply(200, {
    success: true,
    data: { data: [memo()], pagination: { page: 1, limit: 20, total: 1, total_pages: 1 } },
  })
  mock.onGet('/service-memos/41').reply(200, { success: true, data: memoDetail() })
})

afterEach(() => {
  mock.reset()
  setTestViewportWidth(DESKTOP)
})

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/memos/history']}>
        <MemoHistoryPage />
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('MemoHistoryPage - desktop', () => {
  beforeEach(() => setTestViewportWidth(DESKTOP))

  test('renders the memo table', async () => {
    renderPage()

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Destination/i })).toBeInTheDocument()
  })

  test('expanding a row loads and shows the memo detail', async () => {
    const user = userEvent.setup()
    renderPage()
    const row = await screen.findByText('Tan Wei Ming')

    await user.click(row)

    expect(await screen.findByText(/Evacuation floors: 3/i)).toBeInTheDocument()
    expect(screen.getByText(/Nurse Lim/)).toBeInTheDocument()
  })
})

describe('MemoHistoryPage - tablet', () => {
  beforeEach(() => setTestViewportWidth(TABLET))

  // Found by looking at a real 768px browser: with the 240px sidebar subtracted the six
  // columns only had ~464px, so the table was clipped inside its card - the "Submitted"
  // column was cut off entirely. A document-level overflow check cannot catch that,
  // because the card's overflow-hidden swallows it. So the card list, not the table,
  // has to carry this width too.
  test('renders the card list, not the clipped table', async () => {
    renderPage()
    await screen.findByTestId('memo-card-41')

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('MemoHistoryPage - mobile', () => {
  beforeEach(() => setTestViewportWidth(PHONE))

  test('renders no table at all', async () => {
    renderPage()
    await screen.findByText('Tan Wei Ming')

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  test('shows every field the table columns carried, so no data is lost', async () => {
    renderPage()

    const card = await screen.findByTestId('memo-card-41')
    expect(within(card).getByText('Tan Wei Ming')).toBeInTheDocument()
    expect(within(card).getByText(/Tan Tock Seng Hospital A&E/)).toBeInTheDocument()
    expect(within(card).getByText(/#17/)).toBeInTheDocument()
    expect(within(card).getByText(/eas/i)).toBeInTheDocument()
    expect(within(card).getByText(/submitted/i)).toBeInTheDocument()
  })

  test('tapping a card expands the same detail the desktop row shows', async () => {
    const user = userEvent.setup()
    renderPage()
    const card = await screen.findByTestId('memo-card-41')

    await user.click(within(card).getByRole('button', { name: /Tan Wei Ming/i }))

    expect(await screen.findByText(/Evacuation floors: 3/i)).toBeInTheDocument()
    expect(screen.getByText(/Nurse Lim/)).toBeInTheDocument()
  })

  test('collapses again on a second tap', async () => {
    const user = userEvent.setup()
    renderPage()
    const card = await screen.findByTestId('memo-card-41')
    const toggle = within(card).getByRole('button', { name: /Tan Wei Ming/i })

    await user.click(toggle)
    expect(await screen.findByText(/Evacuation floors: 3/i)).toBeInTheDocument()

    await user.click(toggle)

    await waitFor(() => expect(screen.queryByText(/Evacuation floors: 3/i)).not.toBeInTheDocument())
  })

  test('keeps pagination reachable', async () => {
    renderPage()
    await screen.findByTestId('memo-card-41')

    expect(screen.getByRole('button', { name: /Previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument()
  })

  test('still renders the empty state when there are no memos', async () => {
    mock.reset()
    mock.onGet('/service-memos').reply(200, {
      success: true,
      data: { data: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } },
    })
    renderPage()

    expect(await screen.findByText('No memos found.')).toBeInTheDocument()
  })
})
