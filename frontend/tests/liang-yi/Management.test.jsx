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
    await userEvent.type(screen.getByPlaceholderText('e.g. john@efar.com.sg'), email);
  }
  if (password !== undefined) {
    await userEvent.type(screen.getByPlaceholderText('Min. 8 chars, 1 number, 1 special character'), password);
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
        user: { id: 99, name: 'Jane Doe', email: 'jane@efar.com.sg', role: 'quotations_specialist' },
      },
    });

    renderPage();
    await openAddUserModal();
    await fillForm({ name: 'Jane Doe', email: 'jane@efar.com.sg', password: 'Efar@2026' });
    await submit();

    // Success message: this app shows all confirmations via in-app toast (per CLAUDE.md),
    // never an inline "email sent" banner - see ToastContext.jsx.
    expect(await screen.findByText('Account created for Jane Doe.')).toBeInTheDocument();

    // Modal closes on success.
    expect(screen.queryByRole('heading', { name: 'Add New User' })).not.toBeInTheDocument();

    // New row appears in the User Directory table.
    expect(screen.getByText('jane@efar.com.sg')).toBeInTheDocument();

    // Sanity-check the actual request payload axios-mock-adapter captured.
    expect(mock.history.post).toHaveLength(1);
    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toMatchObject({ name: 'Jane Doe', email: 'jane@efar.com.sg', role: 'quotations_specialist' });
  });

  test('server error (500) shows an error message and keeps the form open', async () => {
    mock.onPost('/auth/register').reply(500, {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong while creating the account. Please try again.',
    });

    renderPage();
    await openAddUserModal();
    await fillForm({ name: 'John Smith', email: 'john@efar.com.sg', password: 'Efar@2026' });
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

  test('rejects a non-@efar.com.sg email before calling the backend', async () => {
    renderPage();
    await openAddUserModal();
    await fillForm({ name: 'Outsider', email: 'outsider@gmail.com', password: 'Efar@2026' });
    await submit();

    // Renders twice - once in the inline field error, once in the toast - so assert
    // on the count rather than a single findByText match.
    expect(await screen.findAllByText('Invalid email. Only @efar.com.sg email addresses are allowed.')).toHaveLength(2);

    // Client-side check runs before any backend call is made.
    expect(mock.history.post).toHaveLength(0);

    // Form stays open so the user can correct the address.
    expect(screen.getByRole('heading', { name: 'Add New User' })).toBeInTheDocument();
  });

  test('rejects a password missing a digit or special character before calling the backend', async () => {
    renderPage();
    await openAddUserModal();
    await fillForm({ name: 'Weak Password', email: 'weak@efar.com.sg', password: 'nodigitsorspecials' });
    await submit();

    const expectedMessage = 'Password must be at least 8 characters long and contain at least one number and one special character.';
    // Renders twice - once in the inline field error, once in the toast.
    expect(await screen.findAllByText(expectedMessage)).toHaveLength(2);

    // Client-side check runs before any backend call is made.
    expect(mock.history.post).toHaveLength(0);

    // Form stays open so the user can correct the password.
    expect(screen.getByRole('heading', { name: 'Add New User' })).toBeInTheDocument();
  });

  test('password visibility toggle switches the input between hidden and visible', async () => {
    renderPage();
    await openAddUserModal();
    await fillForm({ password: 'Efar@2026' });

    const passwordInput = screen.getByPlaceholderText('Min. 8 chars, 1 number, 1 special character');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

// Only rows created through Add New User carry a real backend `id` (the seeded demo
// rows are static mock data with no DB-backed id), so these tests add one first via
// the same mocked /auth/register flow as the tests above.
async function addRealUser() {
  mock.onPost('/auth/register').reply(201, {
    success: true,
    data: {
      token: 'fake-jwt',
      user: { id: 99, name: 'Jane Doe', email: 'jane@efar.com.sg', role: 'quotations_specialist' },
    },
  });
  await openAddUserModal();
  await fillForm({ name: 'Jane Doe', email: 'jane@efar.com.sg', password: 'Efar@2026' });
  await submit();
  await screen.findByText('jane@efar.com.sg');
  mock.resetHistory();
}

describe('Accounts Management - Remove user confirmation', () => {
  test('clicking Remove opens a confirmation modal instead of deleting immediately', async () => {
    renderPage();
    await addRealUser();

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(screen.getByRole('heading', { name: 'Remove User?' })).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to remove/)).toHaveTextContent(
      'Are you sure you want to remove Jane Doe? This action cannot be undone.'
    );

    // No deletion has happened yet - just opening the confirmation makes no request.
    expect(mock.history.delete).toHaveLength(0);
    expect(screen.getByText('jane@efar.com.sg')).toBeInTheDocument();
  });

  test('Cancel closes the modal without deleting the user', async () => {
    renderPage();
    await addRealUser();

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'Remove User?' })).not.toBeInTheDocument();
    expect(mock.history.delete).toHaveLength(0);
    expect(screen.getByText('jane@efar.com.sg')).toBeInTheDocument();
  });

  test('confirming removal calls the delete endpoint and updates the UI on success', async () => {
    mock.onDelete('/users/99').reply(200, { success: true, data: { message: 'User removed.' } });

    renderPage();
    await addRealUser();

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove User' }));

    expect(await screen.findByText("Jane Doe's account was removed.")).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Remove User?' })).not.toBeInTheDocument();
    expect(screen.queryByText('jane@efar.com.sg')).not.toBeInTheDocument();
    expect(mock.history.delete).toHaveLength(1);
  });

  test('confirming removal keeps the modal open and shows an error on failure', async () => {
    mock.onDelete('/users/99').reply(409, {
      success: false,
      code: 'USER_IN_USE',
      message: 'This user has associated records and cannot be removed.',
    });

    renderPage();
    await addRealUser();

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove User' }));

    expect(await screen.findByText('This user has associated records and cannot be removed.')).toBeInTheDocument();

    // Modal stays open so the admin can retry or cancel; row is still present.
    expect(screen.getByRole('heading', { name: 'Remove User?' })).toBeInTheDocument();
    expect(screen.getByText('jane@efar.com.sg')).toBeInTheDocument();
  });
});
