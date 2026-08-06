// Owner: Kwan Hua (Xero Foundation).
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import XeroConnectPage from '@/pages/vendor/XeroConnectPage'

jest.mock('@/hooks', () => ({
  useAuth: () => ({ user: { id: 2, role: 'ar_specialist' } }),
}))

let mock

beforeEach(() => { mock = new MockAdapter(api) })
afterEach(() => { mock.restore() })

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings/xero']}>
      <ToastProvider>
        <XeroConnectPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('XeroConnectPage', () => {
  test('shows LIVE mode and explains that an expired access token auto-refreshes', async () => {
    mock.onGet('/xero/status').reply(200, {
      success: true,
      data: {
        is_connected: true,
        xero_org_name: 'Demo Company (Global)',
        xero_tenant_id: 'tenant-123',
        connected_at: '2026-08-04T06:38:43.347Z',
        token_expiry: '2020-01-01T00:00:00.000Z',
        mode: { simulated: false, label: 'LIVE', detail: 'Connected to the live Xero API.' },
      },
    })

    renderPage()

    expect(await screen.findByText('LIVE')).toBeInTheDocument()
    expect(screen.getByText('Connected to the live Xero API.')).toBeInTheDocument()
    expect(screen.getByText(/Access token has expired.*auto-refresh on the next sync/i)).toBeInTheDocument()
    expect(screen.queryByText(/Ask the Managing Director to reconnect/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/bank feed ingestion/i)).not.toBeInTheDocument()
  })

  test('makes simulation mode unmistakable even when Xero is disconnected', async () => {
    mock.onGet('/xero/status').reply(200, {
      success: true,
      data: {
        is_connected: false,
        xero_org_name: null,
        xero_tenant_id: null,
        connected_at: null,
        token_expiry: null,
        mode: {
          simulated: true,
          label: 'SIMULATION',
          detail: 'Xero calls are simulated - no data is sent to Xero.',
        },
      },
    })

    renderPage()

    expect(await screen.findByText('SIMULATION')).toBeInTheDocument()
    expect(screen.getByText(/no data is sent to Xero/i)).toBeInTheDocument()
    expect(screen.getByText('Not connected to Xero')).toBeInTheDocument()
  })
})
