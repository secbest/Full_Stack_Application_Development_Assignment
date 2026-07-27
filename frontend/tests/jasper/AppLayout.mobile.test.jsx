// Owner: Jasper - Wave 2A mobile responsiveness.
//
// Covers the responsive app shell: below Tailwind's `md` breakpoint the 240px sidebar
// becomes an off-canvas drawer behind a hamburger, because on a 375px phone the static
// sidebar consumed 64% of the viewport and left the field crew nothing to work in.
//
// These assertions deliberately test *state and gating*, not layout. jsdom does not
// evaluate CSS, so a test claiming `md:hidden` "hides" something would be asserting on a
// class string, not on behaviour. The layouts themselves are verified in a real browser.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import AppLayout from '@/layouts/AppLayout'

const DESKTOP = 1280
const PHONE = 375

/** An unsigned JWT whose payload AuthProvider can decode - it never leaves the client. */
function fieldCrewToken() {
  const payload = {
    id: 9,
    name: 'Ravi Kumar',
    email: 'ravi@efar.sg',
    role: 'field_crew',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const encode = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`
}

function renderShell() {
  return render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/jobs']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/jobs" element={<div>My Jobs Screen</div>} />
              <Route path="/memos/history" element={<div>Memo History Screen</div>} />
              <Route path="/settings" element={<div>Settings Screen</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

const hamburger = () => screen.queryByRole('button', { name: /open navigation menu/i })

beforeEach(() => {
  localStorage.setItem('efar_token', fieldCrewToken())
})

afterEach(() => {
  localStorage.clear()
  setTestViewportWidth(DESKTOP)
})

describe('AppLayout - desktop', () => {
  beforeEach(() => setTestViewportWidth(DESKTOP))

  test('renders no hamburger, because the sidebar is already visible', () => {
    renderShell()

    expect(hamburger()).not.toBeInTheDocument()
  })

  test('still exposes the sidebar navigation and the collapse control', () => {
    renderShell()

    expect(screen.getByRole('link', { name: /My Jobs/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument()
  })
})

describe('AppLayout - mobile drawer', () => {
  beforeEach(() => setTestViewportWidth(PHONE))

  test('renders a hamburger that starts closed', () => {
    renderShell()

    expect(hamburger()).toBeInTheDocument()
    expect(hamburger()).toHaveAttribute('aria-expanded', 'false')
  })

  test('hides the desktop-only collapse control', () => {
    // Collapsing to an icon rail is meaningless once the sidebar is an overlay.
    renderShell()

    expect(screen.queryByRole('button', { name: /collapse sidebar/i })).not.toBeInTheDocument()
  })

  test('opening the drawer marks it expanded and gives it dialog semantics', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(hamburger())

    expect(hamburger()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: /main navigation/i })).toBeInTheDocument()
  })

  test('closes when a navigation link is tapped', async () => {
    // Without this the drawer stays open on top of the screen the crew just navigated to.
    const user = userEvent.setup()
    renderShell()
    await user.click(hamburger())

    await user.click(screen.getByRole('link', { name: /Memo History/i }))

    expect(await screen.findByText('Memo History Screen')).toBeInTheDocument()
    await waitFor(() => expect(hamburger()).toHaveAttribute('aria-expanded', 'false'))
  })

  test('closes when the backdrop is tapped', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(hamburger())

    await user.click(screen.getByTestId('sidebar-backdrop'))

    await waitFor(() => expect(hamburger()).toHaveAttribute('aria-expanded', 'false'))
  })

  test('closes on Escape', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(hamburger())

    await user.keyboard('{Escape}')

    await waitFor(() => expect(hamburger()).toHaveAttribute('aria-expanded', 'false'))
  })

  test('closes via the drawer close button', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(hamburger())

    await user.click(screen.getByRole('button', { name: /close navigation menu/i }))

    await waitFor(() => expect(hamburger()).toHaveAttribute('aria-expanded', 'false'))
  })

  test('locks body scroll while the drawer is open and restores it after', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(hamburger())
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'))
  })
})

describe('AppLayout - crossing the breakpoint', () => {
  test('an open drawer does not linger as an overlay when resized to desktop', async () => {
    // Rotating a tablet, or a desktop user narrowing then widening the window.
    const user = userEvent.setup()
    setTestViewportWidth(PHONE)
    renderShell()
    await user.click(hamburger())
    expect(hamburger()).toHaveAttribute('aria-expanded', 'true')

    setTestViewportWidth(DESKTOP)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
