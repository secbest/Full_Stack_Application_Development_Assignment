// Owner: Jasper. NotificationBell is the frontend half of a feature whose backend
// (Notification model, notificationService, seven write sites) already existed with no
// way to read it. Uses axios-mock-adapter against the real shared `api` instance -
// the same convention as MyJobsPage.test.jsx - rather than jest.mock on the wrapper
// module, so a real request that isn't stubbed fails loudly instead of resolving undefined.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { NotificationBell } from '@/components/NotificationBell'

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
})

afterEach(() => {
  mock.reset()
  jest.useRealTimers()
})

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  )
}

function notification(overrides = {}) {
  return {
    id: 1, type: 'job_assigned', title: 'New job assigned', body: 'BKG-2026-00001',
    link: '/jobs', is_read: false, created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('NotificationBell - badge', () => {
  test('hides the badge when unread count is zero', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 0 } })
    renderBell()

    await waitFor(() => expect(mock.history.get).toHaveLength(1))
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  test('shows the unread count', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 3 } })
    renderBell()

    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  test('shows 9+ above nine', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 12 } })
    renderBell()

    expect(await screen.findByText('9+')).toBeInTheDocument()
  })
})

describe('NotificationBell - dropdown', () => {
  test('keeps the dropdown inside the viewport when mounted in the left sidebar', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 0 } })
    mock.onGet('/notifications').reply(200, { success: true, data: [] })
    const user = userEvent.setup()
    renderBell()
    const bell = await screen.findByRole('button', { name: /notifications/i })
    jest.spyOn(bell, 'getBoundingClientRect').mockReturnValue({
      bottom: 60, right: 220, left: 180, top: 20, width: 40, height: 40, x: 180, y: 20,
      toJSON: () => {},
    })

    await user.click(bell)

    expect(await screen.findByRole('dialog', { name: /notifications panel/i })).toHaveStyle({ left: '8px' })
  })

  test('clicking an unread notification marks it read and navigates to its link', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 1 } })
    mock.onGet('/notifications').reply(200, { success: true, data: [notification()] })
    mock.onPatch('/notifications/1/read').reply(200, { success: true, data: { id: 1, is_read: true } })
    const user = userEvent.setup()
    renderBell()
    await screen.findByText('1')

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await screen.findByText('New job assigned')
    await user.click(screen.getByText('New job assigned'))

    await waitFor(() => expect(mock.history.patch).toHaveLength(1))
    expect(mock.history.patch[0].url).toBe('/notifications/1/read')
  })

  test('"Mark all as read" calls the read-all endpoint and clears the badge', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 2 } })
    mock.onGet('/notifications').reply(200, { success: true, data: [notification(), notification({ id: 2 })] })
    mock.onPatch('/notifications/read-all').reply(200, { success: true, data: { marked_read: true } })
    const user = userEvent.setup()
    renderBell()
    await screen.findByText('2')

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await screen.findByText('Mark all as read')
    await user.click(screen.getByText('Mark all as read'))

    await waitFor(() => expect(mock.history.patch).toHaveLength(1))
    expect(mock.history.patch[0].url).toBe('/notifications/read-all')
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })
})

describe('NotificationBell - polling', () => {
  test('pauses while the document is hidden and resumes when visible again', async () => {
    jest.useFakeTimers({ legacyFakeTimers: false })
    let requestCount = 0
    mock.onGet('/notifications/unread-count').reply(() => { requestCount += 1; return [200, { success: true, data: { count: 0 } }] })
    renderBell()
    await waitFor(() => expect(requestCount).toBe(1))

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await jest.advanceTimersByTimeAsync(30000)
    expect(requestCount).toBe(1)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(requestCount).toBe(2))
  })

  test('clears its interval on unmount', async () => {
    jest.useFakeTimers({ legacyFakeTimers: false })
    let requestCount = 0
    mock.onGet('/notifications/unread-count').reply(() => { requestCount += 1; return [200, { success: true, data: { count: 0 } }] })
    const { unmount } = renderBell()
    await waitFor(() => expect(requestCount).toBe(1))

    unmount()
    await jest.advanceTimersByTimeAsync(60000)

    expect(requestCount).toBe(1)
  })
})
