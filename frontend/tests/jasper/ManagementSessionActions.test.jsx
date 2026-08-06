// Tests the session-specific behaviors on the Managing Director's Accounts Management
// screen (frontend/src/pages/dashboard/Management.jsx) that Liang Yi's test file never
// covered: Force Logout, Unlock, and the Security Alerts KPI card. These exercise the
// real GET /api/users data fetch (Task 7) rather than the old hardcoded mock array.
jest.mock('../../src/api', () => {
  const axios = require('axios');
  return { __esModule: true, default: axios.create() };
});

const axiosMockAdapter = require('axios-mock-adapter');
const MockAdapter = axiosMockAdapter.default || axiosMockAdapter;
const api = require('../../src/api').default;

const React = require('react');
const { render, screen } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;

const { ToastProvider } = require('../../src/context/ToastContext');
const ManagementPage = require('../../src/pages/dashboard/Management').default;

let mock;

const ONLINE_USER = { id: 10, name: 'Sarah Lim', email: 'sarah@efar.com.sg', role: 'ar_specialist', last_login_at: new Date().toISOString(), last_active_at: new Date().toISOString(), is_online: true, is_locked: false };
const LOCKED_USER = { id: 11, name: 'Chloe Tan', email: 'chloe@efar.com.sg', role: 'ap_specialist', last_login_at: new Date().toISOString(), last_active_at: null, is_online: false, is_locked: true };

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
});

function renderPage() {
  return render(React.createElement(ToastProvider, null, React.createElement(ManagementPage)));
}

describe('Accounts Management - Force Logout', () => {
  test('is only shown for an Online user, calls the force-logout endpoint, and refetches', async () => {
    mock.onGet('/users').reply(200, { success: true, data: [ONLINE_USER, LOCKED_USER] });
    renderPage();
    await screen.findByText('sarah@efar.com.sg');

    // Only the Online user gets a Force Logout button; the Locked user gets Unlock instead.
    expect(screen.getAllByRole('button', { name: 'Force Logout' })).toHaveLength(1);

    mock.onPost('/users/10/force-logout').reply(200, { success: true, data: { message: 'User has been logged out of all sessions.' } });
    mock.onGet('/users').reply(200, { success: true, data: [{ ...ONLINE_USER, is_online: false }, LOCKED_USER] });

    await userEvent.click(screen.getByRole('button', { name: 'Force Logout' }));

    expect(await screen.findByText('Sarah Lim has been logged out of all sessions.')).toBeInTheDocument();
    expect(mock.history.post.filter((c) => c.url === '/users/10/force-logout')).toHaveLength(1);
  });
});

describe('Accounts Management - Force Logout for a locked-and-online account', () => {
  test('a user who is both locked and online shows BOTH Force Logout and Unlock', async () => {
    const LOCKED_AND_ONLINE_USER = { ...LOCKED_USER, is_online: true, last_active_at: new Date().toISOString() };
    mock.onGet('/users').reply(200, { success: true, data: [LOCKED_AND_ONLINE_USER] });
    renderPage();
    await screen.findByText('chloe@efar.com.sg');

    // Status still collapses to "Locked" for display, but isOnline is tracked
    // separately, so the MD can terminate the live session without unlocking first.
    expect(screen.getByRole('button', { name: 'Force Logout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument();
  });
});

describe('Accounts Management - Unlock', () => {
  test('is only shown for a Locked user, calls the unlock endpoint, refetches, and clears the risk row', async () => {
    mock.onGet('/users').reply(200, { success: true, data: [ONLINE_USER, LOCKED_USER] });
    renderPage();
    await screen.findByText('chloe@efar.com.sg');

    expect(screen.getAllByRole('button', { name: 'Unlock' })).toHaveLength(1);

    mock.onPost('/users/11/unlock').reply(200, { success: true, data: { message: 'User account has been unlocked.' } });
    mock.onGet('/users').reply(200, { success: true, data: [ONLINE_USER, { ...LOCKED_USER, is_locked: false }] });

    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText("Chloe Tan's account has been unlocked.")).toBeInTheDocument();
    expect(mock.history.post.filter((c) => c.url === '/users/11/unlock')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument();
  });
});

describe('Accounts Management - KPI cards', () => {
  test('Security Alerts reflects the real count of locked accounts', async () => {
    mock.onGet('/users').reply(200, { success: true, data: [ONLINE_USER, LOCKED_USER] });
    renderPage();
    await screen.findByText('chloe@efar.com.sg');

    expect(screen.getByText('Security Alerts').closest('div').textContent).toContain('1');
  });
});
