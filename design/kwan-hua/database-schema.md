# Database Schema - Kwan Hua

**Feature Area:** Xero Foundation, OCR & AP Processing

---

## Tables Owned

- `xero_connections`
- `gmail_connections`
- `vendor_invoices`
- `vendor_invoice_items`
- `xero_sync_logs`

## Foreign Key Dependencies from Teammates

| Column | References | Owner |
|--------|-----------|-------|
| `vendor_invoices.uploaded_by` | `users.id` | Group (shared) |
| `vendor_invoices.approved_by` | `users.id` | Group (shared) |

> **Note on `xero_sync_logs`:** This table uses a polymorphic `entity_type` + `entity_id` pattern - no database-level FK constraint is enforced on `entity_id`. Logically, when `entity_type = 'ar_invoice'`, `entity_id` references `invoices.id` (Jasper); when `entity_type = 'vendor_invoice'`, it references `vendor_invoices.id` (this schema).

---

## Table: `xero_connections`

Stores the active Xero OAuth2 connection for the platform. Designed as a single-row configuration table - only one Xero organisation is connected at a time. The `access_token` and `refresh_token` fields must be encrypted at the application layer before being persisted and must never be returned in API responses. The `token_expiry` field allows the backend to preemptively refresh tokens before they expire (UC-02), avoiding 401 errors mid-sync.

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `xero_tenant_id` | `DataTypes.STRING(100)` | NOT NULL, Unique |
| `xero_org_name` | `DataTypes.STRING(255)` | NOT NULL |
| `access_token` | `DataTypes.TEXT` | NOT NULL |
| `refresh_token` | `DataTypes.TEXT` | NOT NULL |
| `token_expiry` | `DataTypes.DATE` | NOT NULL |
| `is_connected` | `DataTypes.BOOLEAN` | NOT NULL, Default: `true` |
| `connected_at` | `DataTypes.DATE` | NOT NULL |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
XeroConnection.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  xero_tenant_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  xero_org_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  token_expiry: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  is_connected: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  connected_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, { sequelize, modelName: 'XeroConnection', tableName: 'xero_connections', underscored: true })
```

### Associations

```js
// No foreign key associations - standalone configuration table.
```

---

## Table: `gmail_connections`

Stores the Gmail inbox connected for automatic AP invoice intake. Like `xero_connections`, only one inbox is expected to be active at a time (`is_connected = true`), but rows for previously-connected addresses are kept (deactivated) rather than deleted, so reconnecting the same or a different address does not lose history. Only the encrypted `refresh_token` is persisted - short-lived Gmail access tokens are requested from Google on demand when an import runs, so nothing beyond the refresh token needs to survive a restart.

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `gmail_address` | `DataTypes.STRING(320)` | NOT NULL, Unique |
| `refresh_token` | `DataTypes.TEXT` | NOT NULL (AES-256-GCM encrypted at the application layer) |
| `is_connected` | `DataTypes.BOOLEAN` | NOT NULL, Default: `true` |
| `connected_at` | `DataTypes.DATE` | NOT NULL |
| `connected_by` | `DataTypes.INTEGER` | allowNull: true, Foreign Key → `users.id` |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
GmailConnection.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  gmail_address: {
    type: DataTypes.STRING(320),
    allowNull: false,
    unique: true,
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  is_connected: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  connected_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  connected_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
}, { sequelize, modelName: 'GmailConnection', tableName: 'gmail_connections', underscored: true })
```

### Associations

```js
// No declared association to User on connected_by - it is a plain nullable FK column.
```

---

## Table: `vendor_invoices`

Stores vendor PDF invoices uploaded by the AP Specialist (Chloe), either directly or via the automatic email/Gmail intake path. Each record tracks the full lifecycle from initial upload through OCR extraction, GST/rebate calculation, manual review, and Xero sync. The `pdf_url` field holds the Cloudinary-hosted file URL. The `extracted_total`, `rebate_amount`, and `verified_total` fields are populated by the automated OCR and rebate verification pipeline (UC-04, UC-05); the `gst_*`, `xero_tax_type`/`xero_account_code`, and `subtotal_excluding_gst`/`gst_amount`/`total_including_gst` fields hold the GST treatment resolved for the invoice and the totals split out for Xero bill coding. `extraction_checks`, `extracted_items_sum`, and `reconciliation_delta` are the arithmetic/format reconciliation facts written by `ocrService.reconcile()` so the review screen can show *why* an invoice needs a closer look, not just a bare confidence score. A unique composite index on `(vendor_name, invoice_number)` enforces duplicate detection at the database level (UC-06), and a separate unique index on `inbound_email_id` makes inbound-email/Gmail imports idempotent under provider retries.

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `uploaded_by` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `users.id` |
| `approved_by` | `DataTypes.INTEGER` | allowNull: true, Foreign Key → `users.id` |
| `vendor_name` | `DataTypes.STRING(255)` | NOT NULL |
| `invoice_number` | `DataTypes.STRING(100)` | NOT NULL |
| `invoice_date` | `DataTypes.DATEONLY` | allowNull: true |
| `due_date` | `DataTypes.DATEONLY` | allowNull: true |
| `pdf_url` | `DataTypes.STRING(512)` | NOT NULL |
| `inbound_email_id` | `DataTypes.STRING(512)` | allowNull: true, Unique index (idempotency key for inbound-email/Gmail imports; format `gmail:<messageId>` for Gmail-sourced invoices) |
| `currency_code` | `DataTypes.STRING(3)` | NOT NULL, Default: `'SGD'` |
| `supplier_gst_registration_no` | `DataTypes.STRING(50)` | allowNull: true |
| `gst_treatment` | `DataTypes.STRING(30)` | NOT NULL, Default: `'non_gst'`, must be one of `standard_rated`, `zero_rated`, `exempt`, `non_gst`, `disallowed` |
| `gst_rate_id` | `DataTypes.INTEGER` | allowNull: true, Foreign Key → `gst_rates.id` |
| `gst_rate_percent` | `DataTypes.DECIMAL(5, 2)` | allowNull: true |
| `gst_effective_date` | `DataTypes.DATEONLY` | allowNull: true |
| `xero_tax_type` | `DataTypes.STRING(50)` | allowNull: true |
| `xero_account_code` | `DataTypes.STRING(20)` | allowNull: true |
| `subtotal_excluding_gst` | `DataTypes.DECIMAL(10, 2)` | allowNull: true |
| `gst_amount` | `DataTypes.DECIMAL(10, 2)` | allowNull: true |
| `total_including_gst` | `DataTypes.DECIMAL(10, 2)` | allowNull: true |
| `extracted_total` | `DataTypes.DECIMAL(10, 2)` | allowNull: true |
| `rebate_percentage` | `DataTypes.DECIMAL(5, 2)` | NOT NULL, Default: `1.00` |
| `rebate_amount` | `DataTypes.DECIMAL(10, 2)` | allowNull: true |
| `verified_total` | `DataTypes.DECIMAL(10, 2)` | allowNull: true |
| `extraction_confidence` | `DataTypes.FLOAT` | allowNull: true |
| `is_low_confidence` | `DataTypes.BOOLEAN` | NOT NULL, Default: `false` |
| `extraction_checks` | `DataTypes.JSONB` | NOT NULL, Default: `[]` - array of `{ check, passed, detail }` written by `ocrService.reconcile()` |
| `extracted_items_sum` | `DataTypes.DECIMAL(10, 2)` | allowNull: true |
| `reconciliation_delta` | `DataTypes.DECIMAL(10, 2)` | allowNull: true |
| `status` | `DataTypes.ENUM('pending_review', 'extraction_failed', 'approved', 'rejected', 'synced_to_xero', 'failed')` | NOT NULL, Default: `'pending_review'` |
| `xero_bill_id` | `DataTypes.STRING(255)` | allowNull: true |
| `rejection_reason` | `DataTypes.TEXT` | allowNull: true |
| `approved_at` | `DataTypes.DATE` | allowNull: true |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
VendorInvoice.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  uploaded_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  vendor_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  invoice_number: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  invoice_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  pdf_url: {
    type: DataTypes.STRING(512),
    allowNull: false,
  },
  inbound_email_id: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  currency_code: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'SGD',
  },
  supplier_gst_registration_no: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  gst_treatment: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'non_gst',
    validate: { isIn: [['standard_rated', 'zero_rated', 'exempt', 'non_gst', 'disallowed']] },
  },
  gst_rate_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'gst_rates', key: 'id' },
  },
  gst_rate_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  gst_effective_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  xero_tax_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  xero_account_code: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  subtotal_excluding_gst: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  gst_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  total_including_gst: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  extracted_total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  rebate_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 1.00,
  },
  rebate_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  verified_total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  extraction_confidence: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  is_low_confidence: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  extraction_checks: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  extracted_items_sum: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  reconciliation_delta: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending_review', 'extraction_failed', 'approved', 'rejected', 'synced_to_xero', 'failed'),
    allowNull: false,
    defaultValue: 'pending_review',
  },
  xero_bill_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'VendorInvoice',
  tableName: 'vendor_invoices',
  underscored: true,
  indexes: [
    { unique: true, fields: ['vendor_name', 'invoice_number'] },
    { unique: true, fields: ['inbound_email_id'] },
  ],
})
```

### Associations

```js
VendorInvoice.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploadedBy' })
VendorInvoice.belongsTo(User, { foreignKey: 'approved_by', as: 'approvedBy' })
VendorInvoice.hasMany(VendorInvoiceItem, { foreignKey: 'vendor_invoice_id', onDelete: 'CASCADE' })
VendorInvoice.hasMany(XeroSyncLog, { foreignKey: 'entity_id', scope: { entity_type: 'vendor_invoice' }, as: 'syncLogs' })
```

---

## Table: `vendor_invoice_items`

Stores individual line items OCR-extracted from a vendor invoice PDF. Each row maps to one line in the vendor's invoice. Items can be corrected by Chloe during the AP review (UC-06); corrections are written back to these rows directly - the `updated_at` timestamp records when a field was last changed.

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `vendor_invoice_id` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `vendor_invoices.id`, onDelete: CASCADE |
| `description` | `DataTypes.STRING(500)` | NOT NULL |
| `quantity` | `DataTypes.DECIMAL(10, 2)` | NOT NULL, Default: `1.00` |
| `unit_price` | `DataTypes.DECIMAL(10, 2)` | NOT NULL |
| `amount` | `DataTypes.DECIMAL(10, 2)` | NOT NULL |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
VendorInvoiceItem.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  vendor_invoice_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'vendor_invoices', key: 'id' },
    onDelete: 'CASCADE',
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1.00,
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, { sequelize, modelName: 'VendorInvoiceItem', tableName: 'vendor_invoice_items', underscored: true })
```

### Associations

```js
VendorInvoiceItem.belongsTo(VendorInvoice, { foreignKey: 'vendor_invoice_id' })
```

---

## Table: `xero_sync_logs`

Audit log for every Xero API sync attempt - covering both AR invoices (Jasper) and AP vendor invoices (this feature). Uses a polymorphic `entity_type` + `entity_id` pattern so both flows write to one shared table, giving the sync status panel (UC-08) a unified view across AR and AP. `attempt_count` increments on every retry; the UC-08 edge case disables the retry button and shows "Contact Support" once this reaches 3 or more.

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `entity_type` | `DataTypes.ENUM('ar_invoice', 'vendor_invoice', 'bank_feed')` | NOT NULL |
| `entity_id` | `DataTypes.INTEGER` | NOT NULL |
| `xero_record_id` | `DataTypes.STRING(255)` | allowNull: true |
| `status` | `DataTypes.ENUM('pending', 'success', 'failed')` | NOT NULL, Default: `'pending'` |
| `attempt_count` | `DataTypes.INTEGER` | NOT NULL, Default: `1` |
| `error_message` | `DataTypes.TEXT` | allowNull: true |
| `synced_at` | `DataTypes.DATE` | allowNull: true |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
XeroSyncLog.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  entity_type: {
    type: DataTypes.ENUM('ar_invoice', 'vendor_invoice', 'bank_feed'),
    allowNull: false,
  },
  entity_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  xero_record_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  attempt_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  synced_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, { sequelize, modelName: 'XeroSyncLog', tableName: 'xero_sync_logs', underscored: true })
```

### Associations

```js
// Polymorphic - no static belongsTo. Queries always filter by entity_type.
// Scoped associations are declared on the owning models:
//   VendorInvoice.hasMany(XeroSyncLog, { foreignKey: 'entity_id', scope: { entity_type: 'vendor_invoice' }, as: 'syncLogs' })
//   Invoice.hasMany(XeroSyncLog, { foreignKey: 'entity_id', scope: { entity_type: 'ar_invoice' }, as: 'syncLogs' })
```

---

## Status Flow Reference

### `vendor_invoices.status`

```
pending_review ──► approved ──► synced_to_xero
               │
               ├──► rejected          (Chloe explicitly rejects - UC-06)
               │
               ├──► extraction_failed (Gemini API failed - Chloe can trigger re-extraction - UC-04)
               │
               └──► failed            (Xero push error - retryable via UC-08)
```

### `xero_sync_logs.status`

```
pending ──► success
        │
        └──► failed  (attempt_count increments on each retry;
                      retry button disabled at attempt_count >= 3)
```

### Rebate Calculation (UC-05)

```
rebate_amount  = extracted_total × (rebate_percentage / 100)
verified_total = extracted_total - rebate_amount
```

`rebate_percentage` defaults to `1.00` (1%). Vendors with a custom rebate rate have a non-default value set at upload time. If `extracted_total` is null (incomplete OCR), both derived fields remain null and the calculation is deferred until Chloe enters the total manually.
