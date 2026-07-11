import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '@/context/AuthContext'

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
}
function makeToken(payload) {
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.fakesignature`
}

const ORIGINAL_TOKEN = makeToken({ sub: 7, name: 'Old Name', email: 'old@efar.com', role: 'ar_specialist', exp: Math.floor(Date.now() / 1000) + 3600 })
const NEW_TOKEN = makeToken({ sub: 7, name: 'New Name', email: 'new@efar.com', role: 'ar_specialist', exp: Math.floor(Date.now() / 1000) + 3600 })

function Probe() {
  const { user, updateUser } = useAuth()
  return (
    <div>
      <span data-testid="name">{user?.name}</span>
      <span data-testid="email">{user?.email}</span>
      <button onClick={() => updateUser(NEW_TOKEN)}>update</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.setItem('efar_token', ORIGINAL_TOKEN)
})
afterEach(() => {
  localStorage.clear()
})

test('updateUser stores the new token and re-decodes the user from it', async () => {
  const user = userEvent.setup()
  render(<AuthProvider><Probe /></AuthProvider>)

  expect(screen.getByTestId('name')).toHaveTextContent('Old Name')

  await user.click(screen.getByText('update'))

  expect(screen.getByTestId('name')).toHaveTextContent('New Name')
  expect(screen.getByTestId('email')).toHaveTextContent('new@efar.com')
  expect(localStorage.getItem('efar_token')).toBe(NEW_TOKEN)
})
