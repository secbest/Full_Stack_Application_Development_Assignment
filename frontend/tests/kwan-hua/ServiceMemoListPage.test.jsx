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
