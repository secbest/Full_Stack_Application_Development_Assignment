# Deployment

## Cloud Services

| Service | Provider | Notes |
|---------|----------|-------|
| Frontend | Vite dev server / static host | Local: http://localhost:5173 |
| Backend | Node.js / Express | Local: http://localhost:3000 |
| Database | Supabase (PostgreSQL) | Project: arorhvtvepwimqwhrzps, region: ap-southeast-1 |
| File Storage | Cloudinary | Used for PDF and image uploads |

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

### 3. Create database tables (run once per new environment)

```bash
cd backend
npm run db:sync
```

### 4. Seed demo users (run once)

```bash
npm run db:seed
```

Demo accounts (password: `Efar@2026`):

| Email | Role |
|-------|------|
| doris@efar.com.sg | Managing Director |
| sarah@efar.com.sg | AR Specialist |
| chloe@efar.com.sg | AP Specialist |
| camilla@efar.com.sg | Quotations Specialist |
| ravi@efar.com.sg | Field Crew |

### 5. Start the servers

```bash
# Terminal 1 - backend
cd backend && npm run dev

# Terminal 2 - frontend
cd frontend && npm run dev
```

Open http://localhost:5173 in your browser.

---

## Environment Variables

_Do not include actual secret values here - fill them in your local `.env` file only._

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project base URL (`https://<ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Yes | Supabase public anon key - from Project Settings > API |
| `JWT_SECRET` | Yes (prod) | Long random string used to sign JWTs in production |
| `DEV_JWT_SECRET` | Yes (dev) | Shared dev JWT secret - all teammates must use the same value |
| `PORT` | No | Port the Express server listens on (default: 3000) |
| `FRONTEND_URL` | No | Origin allowed by CORS (default: http://localhost:5173) |
| `NODE_ENV` | No | Set to `production` when deploying |
| `CLOUDINARY_CLOUD_NAME` | For uploads | Cloud name from the Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | For uploads | API key from the Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | For uploads | API secret from the Cloudinary dashboard |
| `GEMINI_API_KEY` | For OCR | Google AI Studio API key (Gemini 1.5 Pro) |
| `XERO_CLIENT_ID` | For Xero | OAuth2 client ID from Xero developer portal |
| `XERO_CLIENT_SECRET` | For Xero | OAuth2 client secret from Xero developer portal |
| `XERO_REDIRECT_URI` | For Xero | OAuth2 callback URL (e.g. `http://localhost:3000/api/xero/callback`) |
| `XERO_ENCRYPTION_KEY` | For Xero | 32-byte hex key for AES-256-GCM encryption of stored Xero tokens |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | No | Backend API base URL - leave empty in dev (Vite proxy handles `/api`) |
| `VITE_CLOUDINARY_CLOUD_NAME` | For uploads | Cloudinary cloud name (same as backend value) |
| `VITE_GEMINI_API_KEY` | For GenAI | Gemini API key for any client-side GenAI features |
