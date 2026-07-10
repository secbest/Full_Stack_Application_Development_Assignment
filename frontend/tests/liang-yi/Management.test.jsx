// Tests the "Add New User" form on the Managing Director's Accounts Management screen
// (frontend/src/pages/dashboard/Management.jsx), which POSTs to /api/auth/register.
//
// The real src/api/index.js reads `import.meta.env.VITE_API_BASE_URL`, which Babel/Jest
// can't parse without extra tooling. We sidestep that entirely by mocking the module to a
// plain axios.create() instance and driving it with axios-mock-adapter - Management.jsx's
// relative import ('../../api') and this test's ('../../src/api') both resolve to the same
// absolute file, so the mock applies no matter which specifier resolves it.
jest.mock('../../src/api', () => {
  const axios = require('axios');
  return { __esModule: true, default: axios.create() };
});

const axiosMockAdapter = require('axios-mock-adapter');
const MockAdapter = axiosMockAdapter.default || axiosMockAdapter;
const api = require('../../src/api').default;

const React = require('react');
const { render, screen, waitFor, within } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;

const { ToastProvider } = require('../../src/context/ToastContext');
const ManagementPage = require('../../src/pages/dashboard/Management').default;

let mock;

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
});

function renderPage() {
  return render(
    React.createElement(ToastProvider, null, React.createElement(ManagementPage))
  );
}

async function openAddUserModal() {
  await userEvent.click(screen.getByRole('button', { name: 'Add New User' }));
}

async function fillForm({ name, email, password }) {
  if (name !== undefined) {
    await userEvent.type(screen.getByPlaceholderText('e.g. John Smith'), name);
  }
  if (email !== undefined) {
    await userEvent.type(screen.getByPlaceholderText('e.g. john@efar.com'), email);
  }
  if (password !== undefined) {
    await userEvent.type(screen.getByPlaceholderText('Min. 8 characters'), password);
  }
}

async function submit() {
  await userEvent.click(screen.getByRole('button', { name: 'Add User' }));
}

describe('Accounts Management - Add New User form', () => {
  test('successful account creation shows a success message and adds the row', async () => {
    mock.onPost('/auth/register').reply(201, {
      success: true,
      data: {
        token: 'fake-jwt',
        user: { id: 99, name: 'Jane Doe', email: 'jane@efar.com', role: 'quotations_specialist' },
      },
    });

    renderPage();
    await openAddUserModal();
    await fillForm({ name: 'Jane Doe', email: 'jane@efar.com', password: 'Efar@2026' });
    await submit();

    // Success message: this app shows all confirmations via in-app toast (per CLAUDE.md),
    // never an inline "email sent" banner - see ToastContext.jsx.
    expect(await screen.findByText('Account created for Jane Doe.')).toBeInTheDocument();

    // Modal closes on success.
    expect(screen.queryByRole('heading', { name: 'Add New User' })).not.toBeInTheDocument();

    // New row appears in the User Directory table.
    expect(screen.getByText('jane@efar.com')).toBeInTheDocument();

    // Sanity-check the actual request payload axios-mock-adapter captured.
    expect(mock.history.post).toHaveLength(1);
    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toMatchObject({ name: 'Jane Doe', email: 'jane@efar.com', role: 'quotations_specialist' });
  });

  test('server error (500) shows an error message and keeps the form open', async () => {
    mock.onPost('/auth/register').reply(500, {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong while creating the account. Please try again.',
    });

    renderPage();
    await openAddUserModal();
    await fillForm({ name: 'John Smith', email: 'john@efar.com', password: 'Efar@2026' });
    await submit();

    // The message renders twice - once in the modal's inline banner and once in the toast
    // (both use role="alert") - so scope the query to the dialog rather than the whole page.
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Something went wrong while creating the account. Please try again.'
    );

    // Form stays open so the user can retry.
    expect(screen.getByRole('heading', { name: 'Add New User' })).toBeInTheDocument();
  });

  test('validation error (400 with field errors) shows the errors on the form', async () => {
    mock.onPost('/auth/register').reply(400, {
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'One or more fields failed validation.',
      errors: [{ field: 'email', message: 'An account with this email already exists.' }],
    });

    renderPage();
    await openAddUserModal();
    await fillForm({ name: 'Existing User', email: 'sarah@efar.com.sg', password: 'Efar@2026' });
    await submit();

    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument();

    // Form stays open with the field error visible so the user can correct it.
    expect(screen.getByRole('heading', { name: 'Add New User' })).toBeInTheDocument();
  });
});
