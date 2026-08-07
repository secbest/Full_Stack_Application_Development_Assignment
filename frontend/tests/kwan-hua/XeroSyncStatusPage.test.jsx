import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import XeroSyncStatusPage from '@/pages/vendor/XeroSyncStatusPage'

let mock

beforeEach(() => { mock = new MockAdapter(api) })
afterEach(() => { mock.restore() })

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <XeroSyncStatusPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('XeroSyncStatusPage', () => {
  test('keeps the status on one line and expands the complete error reason', async () => {
    const reason = "ContactNotFound: The contact 'Esso Petroleum Pte Ltd' does not exist in Xero."
    mock.onGet('/xero/sync-logs').reply(200, {
      success: true,
      data: {
        data: [{
          id: 4,
          entity_type: 'vendor_invoice',
          entity_id: 4,
          entity_reference: 'Esso Petroleum Pte Ltd - INV-2026-00893',
          status: 'failed',
          attempt_count: 1,
          error_message: reason,
          retry_available: true,
          xero_record_id: null,
          synced_at: null,
        }],
        pagination: { page: 1, limit: 50, total: 1, total_pages: 1 },
        status_counts: { pending: 2, success: 7, failed: 4 },
        xero_connected: true,
      },
    })

    renderPage()

    const status = await screen.findByText('Sync Failed')
    expect(status).toHaveClass('whitespace-nowrap')

    const disclosure = screen.getByText('View reason').closest('details')
    expect(disclosure).not.toHaveAttribute('open')
    await userEvent.click(screen.getByText('View reason'))
    expect(disclosure).toHaveAttribute('open')
    expect(screen.getByText(reason)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fix Invoice/i })).toBeInTheDocument()
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument()
  })
})
