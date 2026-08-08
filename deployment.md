# Deployment

## Cloud Services

| Layer | Provider | Public URL |
|-------|----------|------------|
| Frontend | Vercel | `https://full-stack-application-development-pi.vercel.app/` |
| Backend | Render | `https://full-stack-application-development.onrender.com` |
| Database | Supabase (PostgreSQL) | Not public - accessed only via `DATABASE_URL` from the backend |
| File Storage | Cloudinary | Not public - accessed via the Cloudinary SDK/CDN, no dedicated app URL |

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

Copy the example files and fill in real credentials:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

See the environment variable tables below for what each variable does.

### 3. Create tables and seed demo data (run once per new environment, or any time before a demo to reset to a known state)

```bash
cd backend
npm run db:setup
```

This chains `db:sync` (create tables) with every seeder in dependency order: `db:seed` (users) -> `db:seed:clients` -> `db:seed:intakes` -> `db:seed:bookings` -> `db:seed:xero` -> `db:seed:pricing`. Each seeder uses `findOrCreate`, so it's safe to re-run.

To run an individual step instead (e.g. after adding a new seeder), the underlying scripts are still available separately: `db:sync`, `db:seed`, `db:seed:clients`, `db:seed:intakes`, `db:seed:bookings`, `db:seed:xero`, `db:seed:pricing`.

Demo accounts (password: `Efar@2026`):

| Email | Role |
|-------|------|
| doris@efar.com.sg | Managing Director |
| sarah@efar.com.sg | AR Specialist |
| chloe@efar.com.sg | AP Specialist |
| camilla@efar.com.sg | Quotations Specialist |
| ravi@efar.com.sg | Field Crew |

### 4. Start the servers

```bash
# Terminal 1 - backend
cd backend && npm run dev

# Terminal 2 - frontend
cd frontend && npm run dev
```

Open http://localhost:5173 in your browser.

---

## Environment Variables

_Do not include actual secret values here - fill them in your hosting provider's environment settings (Vercel/Render dashboard) or your local `.env` file only._

### Frontend (Vercel) - `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | No | Deployed Render backend URL **including the `/api` path segment**, e.g. `https://efar-api.onrender.com/api`. Leave empty in local dev - Vite's dev server proxies `/api` to `http://localhost:3000` instead. All frontend API calls are written as relative paths (e.g. `/auth/login`) that assume this base already ends in `/api` - omitting the suffix causes every request to 404 against the backend's `/api` mount. |
| `VITE_CLOUDINARY_CLOUD_NAME` | For uploads | Cloudinary cloud name (same value as the backend's `CLOUDINARY_CLOUD_NAME`), used to build client-facing asset URLs. |
| `VITE_GOOGLE_MAPS_API_KEY` | For live fleet map | Browser-restricted Google Maps key (restrict to the Vercel domain) used for customer location autocomplete and the fleet map. |

### Backend (Render) - `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Port the Express server listens on. Render supplies this automatically; only needed for local dev (default: 3000). |
| `NODE_ENV` | Yes (prod) | Set to `production` when deploying. Controls which JWT secret is used (see `JWT_SECRET` below) and Xero logging verbosity. |
| `FRONTEND_URL` | Yes (prod) | Origin allowed by CORS - set to the deployed Vercel URL so the browser app can call the API. |
| `JWT_SECRET` | Yes (prod) | Long random string used to sign JWTs when `NODE_ENV=production`. Generate a fresh value - do not reuse the dev secret. |
| `DEV_JWT_SECRET` | Yes (dev) | Shared dev JWT secret used when `NODE_ENV` is not `production`. All teammates use the same value locally. |
| `GEMINI_API_KEY` | For OCR | Google AI Studio API key used server-side to extract structured data from vendor PDF invoices. |
| `GEMINI_MODEL` | No | Overrides the default Gemini model used for OCR extraction. |
| `GOOGLE_GEOCODING_API_KEY` | For live fleet map | Server-side Google Geocoding API key (separate from the browser-restricted Maps key above). |
| `XERO_SIMULATION` | Yes | `true` (default) simulates Xero calls with no live account needed; set to `false` only once real Xero credentials below are filled in. |
| `XERO_CLIENT_ID` | For real Xero mode | OAuth2 client ID from the Xero developer portal. |
| `XERO_CLIENT_SECRET` | For real Xero mode | OAuth2 client secret from the Xero developer portal. |
| `XERO_REDIRECT_URI` | For real Xero mode | OAuth2 callback URL, pointing at the deployed backend, e.g. `https://<render-app>.onrender.com/api/xero/callback`. |
| `XERO_ENCRYPTION_KEY` | For real Xero mode | 32-byte hex key used to AES-256-GCM encrypt stored Xero OAuth tokens before they're written to the database. |
| `XERO_SCOPES` | No | Overrides the default Xero OAuth scopes. |
| `XERO_SALES_ACCOUNT_CODE` | No | Xero account code applied to AR (ACCREC) invoice line items. |
| `XERO_PURCHASE_ACCOUNT_CODE` | No | Xero account code applied to AP (ACCPAY) bill line items. |
| `AP_INBOUND_EMAIL_ADDRESS` | For AP email intake | Inbound address displayed to AP staff for vendor-invoice email forwarding. |
| `AP_INBOUND_EMAIL_SECRET` | For AP email intake | Shared secret the mail provider sends in a header to authenticate inbound webhook requests. |
| `AP_INBOUND_UPLOADED_BY` | No | Optional AP Specialist user id attributed to emailed-in invoices; otherwise the oldest AP specialist is used. |
| `GOOGLE_GMAIL_CLIENT_ID` | For Gmail AP intake | Google Cloud OAuth web-client ID used to connect an AP inbox. |
| `GOOGLE_GMAIL_CLIENT_SECRET` | For Gmail AP intake | Google Cloud OAuth web-client secret paired with the above. |
| `GOOGLE_GMAIL_REDIRECT_URI` | For Gmail AP intake | OAuth callback URL, pointing at the deployed backend, e.g. `https://<render-app>.onrender.com/api/gmail/callback`. |
| `GOOGLE_GMAIL_INBOX` | No | Display-only expected inbox address shown in the UI. |
| `GMAIL_INTAKE_POLL_MS` | No | How often the server polls the connected Gmail inbox for new vendor invoices (default: 5 minutes, minimum 1 minute). |

### Database (Supabase PostgreSQL)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string, format: `postgres://<user>:<password>@db.<project-ref>.supabase.co:5432/postgres`. Consumed by Sequelize on the backend. |
| `SUPABASE_URL` | Yes | Supabase project base URL, format: `https://<project-ref>.supabase.co`. |
| `SUPABASE_ANON_KEY` | Yes | Supabase public anon key from Project Settings > API. |

### Image Storage (Cloudinary)

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDINARY_CLOUD_NAME` | For uploads | Cloud name from the Cloudinary dashboard. Used server-side to configure the Cloudinary SDK. |
| `CLOUDINARY_API_KEY` | For uploads | API key from the Cloudinary dashboard, used server-side to authenticate uploads. |
| `CLOUDINARY_API_SECRET` | For uploads | API secret from the Cloudinary dashboard - never exposed to the frontend. |
| `VITE_CLOUDINARY_CLOUD_NAME` | For uploads | Same cloud name, exposed to the frontend build to construct read-only asset URLs (see Frontend table above). |
