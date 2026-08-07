import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { ToastProvider } from '@/context/ToastContext'
import VendorInvoiceListPage from '@/pages/vendor/VendorInvoiceListPage'

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
  mock.onGet('/vendor-invoices').reply(200, {
    success: true,
    data: { data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
  })
})

afterEach(() => mock.reset())

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/vendor-invoices']}>
        <Routes>
          <Route path="/vendor-invoices" element={<VendorInvoiceListPage />} />
          <Route path="/vendor-invoices/:id" element={<ReviewDestination />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

function ReviewDestination() {
  const { id } = useParams()
  return <div>Manual invoice review #{id}</div>
}

async function selectPdf(user) {
  await user.click(await screen.findByRole('button', { name: /Upload Invoice/i }))
  const input = document.querySelector('input[type="file"]')
  await user.upload(input, new File(['invoice'], 'vendor-invoice.pdf', { type: 'application/pdf' }))
  expect(screen.getByText('vendor-invoice.pdf')).toBeInTheDocument()
}

test('opens the saved invoice for manual recovery when OCR extraction fails', async () => {
  const user = userEvent.setup()
  mock.onPost('/vendor-invoices').reply(502, {
    success: false,
    code: 'OCR_EXTRACTION_FAILED',
    message: 'Gemini could not extract data from this PDF.',
    data: { id: 27, status: 'extraction_failed', pdf_url: 'https://example.com/invoice.pdf' },
  })
  renderPage()
  await selectPdf(user)

  await user.click(screen.getByRole('button', { name: /Upload & Extract/i }))

  expect(await screen.findByText('Manual invoice review #27')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'OCR failed, but the invoice was saved. Enter the details manually or retry extraction.'
  )
  expect(mock.history.post).toHaveLength(1)
})

test('keeps the upload modal open for failures that did not save an invoice', async () => {
  const user = userEvent.setup()
  mock.onPost('/vendor-invoices').reply(502, {
    success: false,
    code: 'CLOUDINARY_UPLOAD_FAILED',
    message: 'Failed to upload PDF to storage. Please retry.',
  })
  renderPage()
  await selectPdf(user)

  await user.click(screen.getByRole('button', { name: /Upload & Extract/i }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to upload PDF to storage. Please retry.')
  expect(screen.getByText('Upload Vendor Invoice')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: /Upload & Extract/i })).toBeEnabled())
})
