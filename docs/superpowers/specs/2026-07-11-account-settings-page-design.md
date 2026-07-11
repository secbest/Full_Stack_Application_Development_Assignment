# Account Settings Page - Design

## Problem

No role has a personal account settings page. Users can see their name, email, and role in the sidebar footer (`frontend/src/layouts/AppLayout.jsx:62-69`) but cannot edit their profile or change their password. The existing "Xero Integration Settings" screen at `/settings/xero` is unrelated - it configures the Xero connection, not personal account details.

## Scope

A single shared Settings page, available to every role (Managing Director, AR Specialist, AP Specialist, Quotations Specialist, Field Crew), with two independent sections:

1. View + edit profile (name, email). Role is shown read-only - role changes remain Managing-Director-only via the existing Accounts Management page.
2. Change password (current password + new password, with current-password verification).

Out of scope: notification/appearance preferences, self-service role changes, avatar/photo upload, email re-verification (the project has no email service - see CLAUDE.md "No email confirmations").

## Backend

### New files

- `backend/src/controllers/userController.js` - `updateProfile`, `updatePassword`
- `backend/src/validators/userValidators.js` - `updateProfileSchema`, `updatePasswordSchema`
- `backend/src/routes/userRoutes.js` - mounts the two endpoints under `/api/users`. `backend/src/routes/index.js:7-8` already has a commented-out placeholder for this exact file (originally scoped for a future `GET /users?role=` crew list); this spec fills in the self-service endpoints only and leaves the crew-list route as a future addition.

### Endpoints

Both require `authenticate` only (no role restriction - every role edits their own account).

**`PATCH /api/users/me`**
- Body: `{ name, email }`, validated by `updateProfileSchema` (same rules as `registerSchema`: name min 2 max 100, email valid format).
- Checks no *other* user already has that email (`User.findOne({ where: { email, id: { [Op.ne]: req.user.sub } } })`) - if found, responds 409 `EMAIL_IN_USE`.
- Updates the row, then re-signs a JWT with the same claim shape `signToken` already uses in `authController.js` (`{ sub, name, email, role }`), since name/email live in the token.
- Response: `{ token, user: { id, name, email, role } }`.

**`PATCH /api/users/me/password`**
- Body: `{ currentPassword, newPassword }`, validated by `updatePasswordSchema` (newPassword min 8 chars, matching `registerSchema`'s password rule).
- Loads the user by `req.user.sub`, `bcrypt.compare`s `currentPassword` against the stored hash. Mismatch -> 401 `INVALID_CREDENTIALS`.
- Hashes `newPassword` (bcrypt, cost 12, matching `authController.js`'s register flow) and saves.
- Response: `{ success: true }` - no token change, since password isn't a JWT claim.

### Shared code note

`signToken` currently lives as a private function inside `authController.js`. It needs to be reusable from `userController.js` - either export it from `authController.js` and import it, or move it to a small shared module (e.g. `backend/src/utils/token.js`). Implementer's choice; either satisfies this spec.

## Frontend

### AuthContext (`frontend/src/context/AuthContext.jsx`)

Add `updateUser(newToken)`: stores the new token in `localStorage`, re-decodes it via the existing `getUserFromToken`, and calls `setToken`/`setUser`. Mirrors what `login()` already does with its returned token. Exposed alongside `token`/`user`/`login`/`logout` in the context value.

### Sidebar entry point (`frontend/src/layouts/AppLayout.jsx`)

Wrap the user-footer block (name/email/role badge, lines 62-69) in a `<NavLink to="/settings">`, with a hover state matching the nav links above it. No new item is added to `NAV_ROUTES` / the visible nav list - this is the only entry point, per explicit decision during design review.

### Routing

- `frontend/src/App.jsx`: add a `<Route path="/settings" element={<SettingsPage />} />` inside the authenticated route tree, gated only by `authenticate` (any logged-in role, no role restriction).
- `frontend/src/router/routes.js`: no `NAV_ROUTES` entry (intentionally not in the sidebar nav list).

### New page - `frontend/src/pages/settings/SettingsPage.jsx`

Follows existing page/card conventions (card radius/shadow/border tokens from CLAUDE.md's design tokens section; Formik+Yup form patterns as used elsewhere, e.g. the contract form).

- Page title "Settings" (24px bold, per design tokens).
- **Card 1 - Profile Information**: Formik+Yup form, fields `name`, `email` (editable), `role` (read-only display, not a form field). Save button calls `PATCH /api/users/me`; on success, calls `updateUser(response.token)` and fires a success toast; on failure shows an inline error under the Email field for `EMAIL_IN_USE`, plus an error toast for anything else.
- **Card 2 - Change Password**: Formik+Yup form, fields `currentPassword`, `newPassword`, `confirmPassword` (`confirmPassword` is a frontend-only Yup `.oneOf([Yup.ref('newPassword')])` check, not sent to the backend). Save button calls `PATCH /api/users/me/password`; on 401 shows an inline error under Current Password ("Incorrect password"); on success, clears all three fields and fires a success toast.
- Each card submits and saves independently - no shared/sticky footer.

## Error handling

- Email conflict (409 `EMAIL_IN_USE`) -> inline field error + error toast, form stays populated with the user's attempted edits.
- Wrong current password (401 `INVALID_CREDENTIALS`) -> inline field error under Current Password, password fields are not cleared so the user can retry the new password without retyping it.
- Any other 4xx/5xx -> generic error toast, matching how other pages in the app already surface API errors.
- Network/validation errors follow the existing shared `validate` middleware envelope (`{ success: false, code, message, errors: [{ field, message }] }`) already used by every other route.

## Testing

- Backend: unit tests for `userController` - profile update happy path, email-taken conflict, password happy path, wrong-current-password rejection. Goes under the implementer's `backend/tests/<student-name>/` folder.
- Frontend: a Jest test for `SettingsPage` - renders both cards, submits a profile update, submits a password change, and asserts validation/error states render. Goes under the implementer's `frontend/tests/<student-name>/` folder.
