import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import ServiceMemoListPage from '@/pages/memos/ServiceMemoListPage'

const queueRow = {
  id: 5,
  booking_id: 8,
  booking_reference: 'BKG-2026-00010',
  client_name: 'Nanyang Poly',
  service_type: 'eas',
  transfer_type: 'two_way_hospital',
  hours_since_submission: 10.6,
}

const memoDetail = {
  ...queueRow,
  patient_name: 'Demo Patient',
  hospital_destination: 'Singapore General Hospital',
  job_start_time: '2026-08-01T08:00:00.000Z',
  job_end_time: '2026-08-01T10:00:00.000Z',
  evacuation_floors: 0,
  is_office_hours: true,
  overtime_hours: 0,
  oxygen_litres_used: 0,
  has_inconvenience_fee: false,
  disposables_used: false,
  resuscitation_performed: false,
  suction_performed: false,
  waiting_time_minutes: 0,
  patient_weight_kg: null,
  is_jurong_island: false,
}

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
})

afterEach(() => mock.reset())

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/service-memos']}>
        <Routes>
          <Route path="/service-memos" element={<ServiceMemoListPage />} />
          <Route path="/invoices/:id" element={<div>Invoice detail destination</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

// Queue rows at different ages, to exercise the >2h amber / >4h red SLA colouring.
const freshRow = { ...queueRow, id: 1, booking_reference: 'BKG-2026-00001', hours_since_submission: 0.5 }
const warningRow = { ...queueRow, id: 2, booking_reference: 'BKG-2026-00002', hours_since_submission: 3 }
const overdueRow = { ...queueRow, id: 3, booking_reference: 'BKG-2026-00003', hours_since_submission: 26 }

function mockQueue(rows) {
  mock.onGet('/service-memos/pending-review').reply(200, {
    success: true,
    data: { data: rows, meta: { total: rows.length, page: 1, limit: 50 } },
  })
}

describe('ServiceMemoListPage - queue', () => {
  test('counts memos by SLA band across the three stat cards', async () => {
    mockQueue([freshRow, warningRow, overdueRow])
    renderPage()

    await screen.findByText('BKG-2026-00001')
    // Awaiting Review = 3, Overdue (>4h) = 1, Approaching (>2h) = 1.
    expect(screen.getByText('Awaiting Review').parentElement).toHaveTextContent('3')
    expect(screen.getByText(/Overdue/).parentElement).toHaveTextContent('1')
    expect(screen.getByText(/Approaching/).parentElement).toHaveTextContent('1')
  })

  test('renders queue age in days once a memo has sat for more than a day', async () => {
    mockQueue([overdueRow])
    renderPage()

    // Raw hours stop being readable past a day - "26h" is fine, but a memo left for a
    // fortnight rendered as "433.8h" left the reader dividing by 24.
    expect(await screen.findByText('1d 2h')).toBeInTheDocument()
  })

  test('renders sub-hour ages in minutes rather than a fractional hour', async () => {
    mockQueue([freshRow])
    renderPage()

    expect(await screen.findByText('30m')).toBeInTheDocument()
  })

  test('flags a memo that has already been returned and corrected', async () => {
    mockQueue([{ ...queueRow, was_returned: true }])
    renderPage()

    // This review is a re-check of a correction, not a first look.
    expect(await screen.findByText('Corrected')).toBeInTheDocument()
  })

  test('shows an explicit empty state when nothing awaits review', async () => {
    mockQueue([])
    renderPage()

    expect(await screen.findByText(/no memos awaiting review/i)).toBeInTheDocument()
  })

  test('reports a failed queue load through a toast', async () => {
    mock.onGet('/service-memos/pending-review').reply(500, { success: false })
    renderPage()

    expect(await screen.findByText(/failed to load the memo review queue/i)).toBeInTheDocument()
  })
})

describe('ServiceMemoListPage - review detail', () => {
  test('shows all nine pricing-engine surcharge inputs, unabbreviated', async () => {
    mockQueue([queueRow])
    mock.onGet('/service-memos/5').reply(200, {
      success: true,
      data: { ...memoDetail, oxygen_litres_used: 15, has_inconvenience_fee: true, patient_weight_kg: 95 },
    })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00010')
    await user.click(screen.getByRole('button', { name: /Review/i }))

    // CLAUDE.md logic correction 1: the review screen must show every surcharge field.
    // Abbreviating any of them hides a chargeable item from the person approving it.
    expect(await screen.findByText('Oxygen Litres Used')).toBeInTheDocument()
    expect(screen.getByText('Inconvenience Fee')).toBeInTheDocument()
    expect(screen.getByText('Disposables Used')).toBeInTheDocument()
    expect(screen.getByText('Resuscitation')).toBeInTheDocument()
    expect(screen.getByText('Suction')).toBeInTheDocument()
    expect(screen.getByText('Waiting Time (min)')).toBeInTheDocument()
    expect(screen.getByText('Patient Weight (kg)')).toBeInTheDocument()
    expect(screen.getByText('Jurong Island')).toBeInTheDocument()
    expect(screen.getByText('Overtime (hrs)')).toBeInTheDocument()
  })

  test('keeps evacuation floors out of the pricing panel', async () => {
    mockQueue([queueRow])
    mock.onGet('/service-memos/5').reply(200, { success: true, data: { ...memoDetail, evacuation_floors: 3 } })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00010')
    await user.click(screen.getByRole('button', { name: /Review/i }))

    // CLAUDE.md logic correction 4: evacuation_floors is documentation only and does not
    // affect billing; the billable stair/lift charge is the separate inconvenience flag.
    const floors = await screen.findByText('Evacuation Floors')
    expect(floors.parentElement.parentElement).not.toHaveClass('border-blue-200')
  })

  test('refuses to return a memo without a correction note', async () => {
    mockQueue([queueRow])
    mock.onGet('/service-memos/5').reply(200, { success: true, data: memoDetail })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00010')
    await user.click(screen.getByRole('button', { name: /Review/i }))
    await user.click(await screen.findByRole('button', { name: /Return Memo/i }))

    // Returning a memo with no reason gives the crew nothing to act on.
    expect(await screen.findByText(/enter a correction note/i)).toBeInTheDocument()
    expect(mock.history.patch).toHaveLength(0)
  })

  test('sends the trimmed note when returning a memo', async () => {
    mockQueue([queueRow])
    mock.onGet('/service-memos/5').reply(200, { success: true, data: memoDetail })
    mock.onPatch('/service-memos/5/return').reply(200, { success: true, data: {} })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00010')
    await user.click(screen.getByRole('button', { name: /Review/i }))
    await user.type(await screen.findByPlaceholderText(/correction note/i), '  Oxygen litres missing  ')
    await user.click(screen.getByRole('button', { name: /Return Memo/i }))

    expect(await screen.findByText(/returned to the field crew/i)).toBeInTheDocument()
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ note: 'Oxygen litres missing' })
  })

  test('reports the invoice total when approval matches cleanly', async () => {
    mockQueue([queueRow])
    mock.onGet('/service-memos/5').reply(200, { success: true, data: memoDetail })
    mock.onPatch('/service-memos/5/approve').reply(200, {
      success: true,
      data: {
        memo_id: 5,
        memo_status: 'reviewed',
        invoice: { id: 42, status: 'matched', total_amount: '926.50', line_items: [] },
        warning: null,
      },
    })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00010')
    await user.click(screen.getByRole('button', { name: /Review/i }))
    await user.click(await screen.findByRole('button', { name: /Approve & Match/i }))

    expect(await screen.findByText(/invoice #42 generated \(\$926\.50\)/i)).toBeInTheDocument()
  })

  test('surfaces the server message when approval is rejected', async () => {
    mockQueue([queueRow])
    mock.onGet('/service-memos/5').reply(200, { success: true, data: memoDetail })
    mock.onPatch('/service-memos/5/approve').reply(409, {
      success: false, message: 'This memo has already been reviewed.',
    })
    renderPage()
    const user = userEvent.setup()

    await screen.findByText('BKG-2026-00010')
    await user.click(screen.getByRole('button', { name: /Review/i }))
    await user.click(await screen.findByRole('button', { name: /Approve & Match/i }))

    expect(await screen.findByText('This memo has already been reviewed.')).toBeInTheDocument()
  })
})

describe('ServiceMemoListPage - unmatched approval recovery', () => {
  test('shows a warning and opens the invoice when approval succeeds without a match', async () => {
    const user = userEvent.setup()
    mock.onGet('/service-memos/pending-review').replyOnce(200, {
      success: true,
      data: { data: [queueRow], meta: { total: 1, page: 1, limit: 50 } },
    })
    mock.onGet('/service-memos/5').reply(200, { success: true, data: memoDetail })
    mock.onPatch('/service-memos/5/approve').reply(200, {
      success: true,
      data: {
        memo_id: 5,
        memo_status: 'reviewed',
        invoice: {
          id: 10, status: 'unmatched', subtotal: 0, tax_amount: 0,
          total_amount: 0, unpriced_surcharges: [], line_items: [],
        },
        warning: {
          code: 'NO_ACTIVE_CONTRACT',
          message: 'Invoice #10 needs pricing because no active contract covers this client and service date.',
        },
      },
    })
    mock.onGet('/service-memos/pending-review').reply(200, {
      success: true,
      data: { data: [], meta: { total: 0, page: 1, limit: 50 } },
    })

    renderPage()
    await screen.findByText('BKG-2026-00010')
    await user.click(screen.getByRole('button', { name: /Review/i }))
    await user.click(await screen.findByRole('button', { name: /Approve & Match/i }))

    expect(await screen.findByText('Invoice detail destination')).toBeInTheDocument()
    const warning = await screen.findByRole('alert')
    expect(warning).toHaveTextContent('Memo approved, but automatic matching needs attention')
    expect(warning.className).toMatch(/border-amber-400/)
    expect(mock.history.patch).toHaveLength(1)
  })
})
