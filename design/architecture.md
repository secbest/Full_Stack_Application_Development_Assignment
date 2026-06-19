# System Architecture

**Project:** Emergencies First Aid & Rescue (EFAR) - Digital Operations-to-Billing Platform

---

## 1. Tech Stack

### Frontend

| Library / Tool | Purpose |
|----------------|---------|
| React 18 | UI component framework |
| Vite 5 | Build tool and local dev server |
| React Router DOM 6 | Client-side routing |
| shadcn/ui | Accessible component library built on Radix UI primitives |
| Tailwind CSS 3 | Utility-first CSS framework (required by shadcn/ui) |
| Formik 2 | Form state management |
| Yup 1 | Form validation schemas |
| Axios 1 | HTTP client for API requests |
| Lucide React | Icon library used by shadcn/ui |
| MUI (Material UI) 6 | Component library for data-heavy UI elements such as tables, data grids, and form controls |
| MUI X Data Grid 7 | Feature-rich table component with sorting, filtering, and pagination for invoice and booking lists |
| MUI X Charts 7 | Bar, line, and pie chart components for the executive dashboard |
| MUI X Date Pickers 7 | Calendar-based date and time picker components for booking and memo forms |

### Backend

| Library / Tool | Purpose |
|----------------|---------|
| Node.js | JavaScript runtime |
| Express 4 | HTTP server and routing framework |
| Sequelize 6 | ORM for PostgreSQL model definitions and queries |
| pg / pg-hstore | PostgreSQL driver used by Sequelize |
| Yup 1 | Request body validation at the API boundary |
| jsonwebtoken 9 | JWT generation and verification for auth |
| bcryptjs 2 | Password hashing |
| Multer 1 | Multipart file upload handling (before Cloudinary upload) |
| dotenv 16 | Loads environment variables from `.env` |
| cors 2 | Cross-origin request headers for frontend-backend communication |

### Database

| Tool | Purpose |
|------|---------|
| PostgreSQL (via Supabase) | Primary relational data store for all operational and financial data |

### Third-Party and AI Services

| Service | Purpose |
|---------|---------|
| Cloudinary | Image and file storage (service memo hospital stamp photos, vendor PDF uploads) |
| Google Gemini API | OCR and structured data extraction from vendor PDF invoices |
| Xero API | Master financial ledger - draft invoice push, bank feed ingestion, GL mapping |

---

## 2. Folder Structure

### frontend/src

```
src/
├── assets/          # Static files - images, icons, fonts
├── components/      # Shared reusable UI components used across multiple pages
│   └── ui/          # shadcn/ui auto-generated component files (do not edit manually)
├── layouts/         # Page wrapper components providing role-specific navigation chrome
├── pages/           # Route-level components grouped by feature area
│   ├── auth/        # Login page
│   ├── intake/      # Customer intake submission form (Quotations Specialist)
│   ├── bookings/    # Booking list, booking detail, crew assignment (Quotations Specialist)
│   ├── memos/       # Digital field memo form, signature capture, stamp upload (Field Crew)
│   ├── invoices/    # Matched invoice review, surcharge adjustment, batch approval (AR Specialist)
│   ├── vendor/      # Vendor PDF upload, OCR review, rebate check, AP approval (AP Specialist)
│   └── dashboard/   # Fleet overview, AR batch status, overhead cost summary (Managing Director)
├── api/             # Axios instance config and per-resource API call functions
├── context/         # React context providers - AuthContext for session and current user
├── hooks/           # Custom React hooks - useAuth, data-fetching hooks per resource
├── schemas/         # Yup validation schemas shared across Formik forms
└── lib/             # Utility functions - cn() helper for shadcn/ui, date and currency formatters
```

### backend/src

```
src/
├── config/          # Database connection, Cloudinary client config, environment validation
├── models/          # Sequelize model definitions and inter-model associations
├── migrations/      # Sequelize migration files for versioned schema changes
├── seeders/         # Seed data for roles, test users, and sample clients
├── routes/          # Express routers - maps URL paths to controller functions only
├── controllers/     # Request handlers - parse req, call services, return res
├── services/        # Pure business logic with no req/res dependency
│   │                #   pricingService.js  - pricing match engine
│   │                #   ocrService.js      - Gemini API extraction
│   │                #   xeroService.js     - Xero OAuth and sync
│   │                #   cloudinaryService.js - file upload and URL handling
├── middleware/      # authenticate.js (JWT verify), requireRole.js (RBAC guard), errorHandler.js
├── validators/      # Yup schemas for validating incoming request bodies
└── utils/           # Shared helpers - apiResponse.js (standard response shape), tokenUtils.js
```

---

## 3. Third-Party Services

### Cloudinary

Used for storing all binary file uploads so they are not held in the database or on the server.

| Upload type | Where used |
|-------------|-----------|
| Hospital stamp photo | Field crew uploads a photo of the physical hospital stamp on a service memo as a policy exception fallback |
| Vendor PDF invoice | AP Specialist uploads vendor bills (diesel, repairs) which are then passed to Gemini for OCR extraction |

Files are uploaded from the backend via the Cloudinary Node.js SDK after Multer receives the multipart form data. The returned secure URL is stored in the relevant database column (`hospital_stamp_image_url`, `pdf_url`).

---

## 4. Generative AI Services

### Google Gemini API

Used in the AP vendor invoice processing workflow to eliminate manual data entry.

**How it works:**
1. AP Specialist uploads a vendor PDF invoice via the platform
2. The PDF is stored in Cloudinary and its URL is passed to the Gemini API
3. Gemini extracts structured fields: vendor name, invoice number, invoice date, line items, and total amount
4. The API returns an `extraction_confidence` score (0-1)
5. If confidence is below the threshold, the record is flagged as `is_low_confidence = true` and surfaced for manual correction before approval
6. The extracted data is pre-populated into the AP review interface for Chloe to verify and approve

**Why Gemini:** Vendor invoices arrive in uncontrolled formats with no consistent layout. A vision-capable model handles this variability without requiring per-vendor parsing rules.

---

## 5. Cloud Services

| Layer | Provider | Purpose |
|-------|----------|---------|
| Frontend | Vercel | Hosts the built React/Vite static output; automatic deploys from the main branch |
| Backend | Render | Runs the Node.js/Express server as a persistent web service |
| Database | Supabase | Managed PostgreSQL instance; connection string is used directly by Sequelize |
| File Storage | Cloudinary | Stores all uploaded images and PDFs; serves them via CDN URLs |

### Environment Variables Required per Layer

**Frontend (`frontend/.env`)**
```
VITE_API_BASE_URL=        # Deployed Render backend URL
VITE_CLOUDINARY_CLOUD_NAME=
```

**Backend (`backend/.env`)**
```
DATABASE_URL=             # Supabase PostgreSQL connection string
SUPABASE_URL=
SUPABASE_ANON_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GEMINI_API_KEY=
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
JWT_SECRET=
PORT=
```

See `deployment.md` for the public URLs of all deployed services.
