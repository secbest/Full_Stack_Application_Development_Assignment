# Database Schema - Jasper

**Feature Area:** AR Billing, Pricing Engine & Invoice Sync

---

## Tables Owned

- `pricing_contracts`
- `pricing_rates`
- `surcharge_schedules`
- `invoices`
- `invoice_line_items`

## Foreign Key Dependencies from Teammates

| Column | References | Owner |
|--------|-----------|-------|
| `pricing_contracts.client_id` | `clients.id` | Group (shared) |
| `pricing_contracts.created_by` | `users.id` | Group (shared) |
| `invoices.memo_id` | `service_memos.id` | Liang Yi |
| `invoices.booking_id` | `bookings.id` | Zheng Bao |
| `invoices.client_id` | `clients.id` | Group (shared) |
| `invoices.contract_id` | `pricing_contracts.id` | Jasper (self) |
| `invoices.approved_by` | `users.id` | Group (shared) |

## Cross-Team Dependency: Fields Required on `service_memos` (Liang Yi)

The pricing engine reads the following fields from the service memo to calculate the invoice. Liang Yi must include these in the `service_memos` table and field memo form.

| Field | Type | Purpose |
|-------|------|---------|
| `service_type` | ENUM | Which EFAR service was performed (EAS, MTS, etc.) |
| `transfer_type` | ENUM | Which specific transfer type was carried out (one-way hospital, airport, etc.) |
| `is_office_hours` | BOOLEAN | Whether the job took place during office hours - determines base rate row |
| `oxygen_litres_used` | DECIMAL | Total oxygen used; engine applies base fee + per-litre charge beyond 10L |
| `has_inconvenience_fee` | BOOLEAN | Stairs or floors involved - flat $50 charge |
| `disposables_used` | BOOLEAN | Whether disposables were consumed - minimum $20 charge |
| `resuscitation_performed` | BOOLEAN | Flat $320 charge if true |
| `suction_performed` | BOOLEAN | Flat $50 charge if true |
| `waiting_time_minutes` | INTEGER | Total waiting time; engine charges per 30-min block |
| `patient_weight_kg` | DECIMAL | Used to determine if heavy lifting surcharge applies (≥90 kg) |
| `is_jurong_island` | BOOLEAN | Whether the job was on Jurong Island - additional transport surcharge |

---

## Table: `pricing_contracts`

Stores each client's negotiated service pricing agreement. One active contract per client at a time is enforced at the application layer. The contract acts as a header linking a client to their specific rate rows in `pricing_rates` and `surcharge_schedules`.

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `client_id` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `clients.id` |
| `created_by` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `users.id` |
| `contract_name` | `DataTypes.STRING(255)` | NOT NULL |
| `effective_from` | `DataTypes.DATEONLY` | NOT NULL |
| `effective_to` | `DataTypes.DATEONLY` | NOT NULL |
| `is_active` | `DataTypes.BOOLEAN` | NOT NULL, Default: `true` |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
PricingContract.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'clients', key: 'id' },
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  contract_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  effective_from: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  effective_to: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, { sequelize, modelName: 'PricingContract', tableName: 'pricing_contracts', underscored: true })
```

### Associations

```js
PricingContract.belongsTo(Client, { foreignKey: 'client_id' })
PricingContract.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' })
PricingContract.hasMany(PricingRate, { foreignKey: 'contract_id', onDelete: 'CASCADE' })
PricingContract.hasMany(SurchargeSchedule, { foreignKey: 'contract_id', onDelete: 'CASCADE' })
PricingContract.hasMany(Invoice, { foreignKey: 'contract_id' })
```

---

## Table: `pricing_rates`

Stores the base rate for each combination of service type, transfer type, and time of day within a contract. The pricing engine looks up exactly one matching row per job to determine the base invoice amount.

**EFAR service types:**
- `eas` - Emergency Ambulance Services
- `mts` - Non-Emergency Medical Transfers (Medical Transport Services)
- `event_standby` - Event Medical Standby Services
- `workplace_standby` - Workplace Medical Standby & Emergency Response

**EFAR transfer types (from the published pricing schedule):**
- `one_way_hospital` - One-way transfer to/from hospital or A&E
- `two_way_hospital` - Two-way hospital or A&E transfer
- `covid_19` - COVID-19 case transport
- `imh_psychiatric` - IMH or psychiatric inter-hospital transfer
- `airport_no_tarmac` - Airport or seaport transfer (without tarmac access)
- `airport_with_tarmac` - Airport or seaport transfer (with tarmac access)
- `sg_jb_ground` - Singapore to Johor Bahru ground transfer (≤1 hour)
- `air_evacuation` - Air evacuation (quoted separately; store agreed rate here)

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `contract_id` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `pricing_contracts.id`, onDelete: CASCADE |
| `service_type` | `DataTypes.ENUM('eas', 'mts', 'event_standby', 'workplace_standby')` | NOT NULL |
| `transfer_type` | `DataTypes.ENUM('one_way_hospital', 'two_way_hospital', 'covid_19', 'imh_psychiatric', 'airport_no_tarmac', 'airport_with_tarmac', 'sg_jb_ground', 'air_evacuation')` | NOT NULL |
| `time_of_day` | `DataTypes.ENUM('office_hours', 'non_office_hours', 'all_hours')` | NOT NULL |
| `base_amount` | `DataTypes.DECIMAL(10, 2)` | NOT NULL |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
PricingRate.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  contract_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'pricing_contracts', key: 'id' },
    onDelete: 'CASCADE',
  },
  service_type: {
    type: DataTypes.ENUM('eas', 'mts', 'event_standby', 'workplace_standby'),
    allowNull: false,
  },
  transfer_type: {
    type: DataTypes.ENUM(
      'one_way_hospital', 'two_way_hospital', 'covid_19', 'imh_psychiatric',
      'airport_no_tarmac', 'airport_with_tarmac', 'sg_jb_ground', 'air_evacuation'
    ),
    allowNull: false,
  },
  time_of_day: {
    type: DataTypes.ENUM('office_hours', 'non_office_hours', 'all_hours'),
    allowNull: false,
  },
  base_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, { sequelize, modelName: 'PricingRate', tableName: 'pricing_rates', underscored: true })
```

### Associations

```js
PricingRate.belongsTo(PricingContract, { foreignKey: 'contract_id' })
```

---

## Table: `surcharge_schedules`

Stores the per-job surcharge rates negotiated within a contract. Each row defines one surcharge type and its applicable amount. The pricing engine applies these on top of the base rate based on what the field crew recorded on the service memo.

**Surcharge types (from the published pricing schedule):**

| Surcharge Type | Description | Default Rate |
|---------------|-------------|-------------|
| `oxygen_base` | Minimum oxygen charge (first 10L) | $50.00 |
| `oxygen_per_litre` | Per-litre charge beyond 10L | $1.00 |
| `inconvenience_fee` | Stairs or floor access | $50.00 |
| `disposables_base` | Minimum disposables usage charge | $20.00 |
| `resuscitation` | Resuscitation performed | $320.00 |
| `suction` | Suction performed | $50.00 |
| `waiting_time_per_30min` | Per 30-minute waiting block | $30.00 |
| `heavy_lifting_min` | Heavy patient (≥90 kg) - minimum. **This is the only one of the pair the pricing engine ever auto-charges.** | $50.00 |
| `heavy_lifting_max` | Heavy patient (≥90 kg) - maximum. Not selected automatically by anything - it exists purely as a manual-adjustment ceiling for the AR Specialist to raise the line to when the job justifies it. | $150.00 |
| `jurong_island_min` | Jurong Island transport - minimum. **This is the only one of the pair the pricing engine ever auto-charges.** | $150.00 |
| `jurong_island_max` | Jurong Island transport - maximum. Not selected automatically by anything - it exists purely as a manual-adjustment ceiling for the AR Specialist to raise the line to when the job justifies it. | $200.00 |
| `cancellation` | Cancellation upon activation (percentage of base amount) | 100.00 |

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `contract_id` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `pricing_contracts.id`, onDelete: CASCADE |
| `surcharge_type` | `DataTypes.ENUM('oxygen_base', 'oxygen_per_litre', 'inconvenience_fee', 'disposables_base', 'resuscitation', 'suction', 'waiting_time_per_30min', 'heavy_lifting_min', 'heavy_lifting_max', 'jurong_island_min', 'jurong_island_max', 'cancellation')` | NOT NULL |
| `amount` | `DataTypes.DECIMAL(10, 2)` | NOT NULL |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
SurchargeSchedule.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  contract_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'pricing_contracts', key: 'id' },
    onDelete: 'CASCADE',
  },
  surcharge_type: {
    type: DataTypes.ENUM(
      'oxygen_base', 'oxygen_per_litre', 'inconvenience_fee', 'disposables_base',
      'resuscitation', 'suction', 'waiting_time_per_30min',
      'heavy_lifting_min', 'heavy_lifting_max',
      'jurong_island_min', 'jurong_island_max',
      'cancellation'
    ),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, { sequelize, modelName: 'SurchargeSchedule', tableName: 'surcharge_schedules', underscored: true })
```

### Associations

```js
SurchargeSchedule.belongsTo(PricingContract, { foreignKey: 'contract_id' })
```

---

## Table: `invoices`

Stores each invoice generated by the pricing match engine from a service memo. One invoice per memo is enforced via the unique constraint on `memo_id`. Status progresses from `matched` through to `synced_to_xero`.

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `memo_id` | `DataTypes.INTEGER` | NOT NULL, Unique, Foreign Key → `service_memos.id` |
| `booking_id` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `bookings.id` |
| `client_id` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `clients.id` |
| `contract_id` | `DataTypes.INTEGER` | allowNull: true, Foreign Key → `pricing_contracts.id` - null on an `unmatched` invoice with no active contract |
| `approved_by` | `DataTypes.INTEGER` | allowNull: true, Foreign Key → `users.id` |
| `subtotal` | `DataTypes.DECIMAL(10, 2)` | NOT NULL, Default: `0.00` |
| `gst_rate_id` | `DataTypes.INTEGER` | allowNull: true, Foreign Key → `gst_rates.id` - the GST rate row in effect on the booking's service date, frozen onto the invoice at generation time |
| `gst_rate_percent` | `DataTypes.DECIMAL(5, 2)` | allowNull: true - the percentage value snapshotted from `gst_rate_id` so a later change to the GST schedule never rewrites an existing invoice |
| `gst_effective_date` | `DataTypes.DATEONLY` | allowNull: true - the effective-from date of the snapshotted GST rate |
| `xero_tax_type` | `DataTypes.STRING(50)` | allowNull: true - the Xero tax type code pushed with the invoice on sync |
| `tax_amount` | `DataTypes.DECIMAL(10, 2)` | NOT NULL, Default: `0.00` |
| `total_amount` | `DataTypes.DECIMAL(10, 2)` | NOT NULL, Default: `0.00` |
| `status` | `DataTypes.ENUM('matched', 'adjusted', 'approved', 'synced_to_xero', 'failed', 'unmatched')` | NOT NULL, Default: `'matched'` |
| `xero_invoice_id` | `DataTypes.STRING(255)` | allowNull: true |
| `approved_at` | `DataTypes.DATE` | allowNull: true |
| `unpriced_surcharges` | `DataTypes.JSONB` | NOT NULL, Default: `[]` - charges the crew recorded on the memo that the matched contract (or the published rate card) had no rate for, as `[{ surcharge_type, label, detail }]`. Written by the pricing engine at approval/rematch time; consumed by the Revenue Leakage report (see `api-documentation.md`) |
| `leakage_dismissed_at` | `DataTypes.DATE` | allowNull: true - set when an MD or AR Specialist closes this row on the Revenue Leakage report as not recoverable; `null` means still open |
| `leakage_dismissed_reason` | `DataTypes.TEXT` | allowNull: true - free-text reason captured at dismissal time |
| `leakage_dismissed_by` | `DataTypes.INTEGER` | allowNull: true, Foreign Key → `users.id` - who dismissed it |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
Invoice.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  memo_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: 'service_memos', key: 'id' },
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'bookings', key: 'id' },
  },
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'clients', key: 'id' },
  },
  contract_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'pricing_contracts', key: 'id' },
  },
  approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
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
  tax_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  status: {
    type: DataTypes.ENUM('matched', 'adjusted', 'approved', 'synced_to_xero', 'failed', 'unmatched'),
    allowNull: false,
    defaultValue: 'matched',
  },
  xero_invoice_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  unpriced_surcharges: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  leakage_dismissed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  leakage_dismissed_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  leakage_dismissed_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
}, { sequelize, modelName: 'Invoice', tableName: 'invoices', underscored: true })
```

### Associations

```js
Invoice.belongsTo(ServiceMemo, { foreignKey: 'memo_id' })
Invoice.belongsTo(Booking, { foreignKey: 'booking_id' })
Invoice.belongsTo(Client, { foreignKey: 'client_id' })
Invoice.belongsTo(PricingContract, { foreignKey: 'contract_id' })
Invoice.belongsTo(User, { foreignKey: 'approved_by', as: 'approvedBy' })
Invoice.belongsTo(User, { foreignKey: 'leakage_dismissed_by', as: 'dismissedBy' })
Invoice.hasMany(InvoiceLineItem, { foreignKey: 'invoice_id', onDelete: 'CASCADE' })
```

---

## Table: `invoice_line_items`

Stores the individual charge line items on each invoice. Auto-generated line items come from the pricing match engine; manual line items are adjustments added by Sarah. The `is_manual_adjustment` flag distinguishes the two for audit purposes.

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `invoice_id` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `invoices.id`, onDelete: CASCADE |
| `description` | `DataTypes.STRING(255)` | NOT NULL |
| `quantity` | `DataTypes.DECIMAL(10, 2)` | NOT NULL, Default: `1.00` |
| `unit_price` | `DataTypes.DECIMAL(10, 2)` | NOT NULL |
| `amount` | `DataTypes.DECIMAL(10, 2)` | NOT NULL |
| `is_manual_adjustment` | `DataTypes.BOOLEAN` | NOT NULL, Default: `false` |
| `line_type` | `DataTypes.ENUM('base', 'surcharge', 'adjustment')` | NOT NULL, Default: `'adjustment'` - what kind of charge this row is: `base` (the transport charge, exactly one per priced invoice), `surcharge` (engine-priced extra), `adjustment` (added by hand by the AR Specialist). Not derivable from `is_manual_adjustment` alone, because an invoice can carry engine-priced surcharges while its base is still unknown |
| `was_manually_edited` | `DataTypes.BOOLEAN` | NOT NULL, Default: `false` - set when an engine-generated row (`is_manual_adjustment = false`) has its figures changed by hand, so a hand-edited amount is never displayed as purely engine-derived |
| `engine_unit_price` | `DataTypes.DECIMAL(10, 2)` | allowNull: true - the engine's original `unit_price` before the first manual edit, captured only once so repeated edits still compare against the engine's real output |
| `engine_amount` | `DataTypes.DECIMAL(10, 2)` | allowNull: true - the engine's original `amount` before the first manual edit, same capture rule as `engine_unit_price` |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
InvoiceLineItem.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  invoice_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'invoices', key: 'id' },
    onDelete: 'CASCADE',
  },
  description: {
    type: DataTypes.STRING(255),
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
  is_manual_adjustment: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  line_type: {
    type: DataTypes.ENUM('base', 'surcharge', 'adjustment'),
    allowNull: false,
    defaultValue: 'adjustment',
  },
  was_manually_edited: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  engine_unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  engine_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
}, { sequelize, modelName: 'InvoiceLineItem', tableName: 'invoice_line_items', underscored: true })
```

### Associations

```js
InvoiceLineItem.belongsTo(Invoice, { foreignKey: 'invoice_id' })
```

---

## How the Pricing Engine Uses These Tables

Given a submitted service memo, the engine runs in two steps:

**Step 1 - Base rate lookup:**
```
pricing_rates WHERE
  contract_id = client's active contract
  AND service_type = memo.service_type
  AND transfer_type = memo.transfer_type
  AND time_of_day = (memo.is_office_hours ? 'office_hours' : 'non_office_hours')
                    OR time_of_day = 'all_hours'
→ one matching row → base_amount becomes the first invoice_line_item
```

**Step 2 - Surcharge application:**
```
For each applicable flag on the memo:
  oxygen_litres_used > 0       → oxygen_base + (litres - 10) * oxygen_per_litre (if > 10L)
  has_inconvenience_fee = true → inconvenience_fee
  disposables_used = true      → disposables_base
  resuscitation_performed      → resuscitation
  suction_performed            → suction
  waiting_time_minutes > 0     → floor(minutes / 30) * waiting_time_per_30min
  patient_weight_kg >= 90      → heavy_lifting_min (engine ONLY ever auto-charges the _min rate)
  is_jurong_island = true      → jurong_island_min (engine ONLY ever auto-charges the _min rate)
→ each applicable surcharge becomes a separate invoice_line_item
```

**Important correction:** the engine does not pick a value from a min-max range - it always charges the `_min` rate automatically for `heavy_lifting` and `jurong_island`. The corresponding `_max` rate is never selected by any code path; it exists solely as a documented ceiling the AR Specialist may manually raise the generated line item to (via `PUT /api/invoices/:invoiceId/line-items/:itemId`) when the job circumstances justify it. See `backend/src/services/pricingService.js` (around lines 163-167).

---

## Status Flow Reference

### `invoices.status`

```
matched → adjusted → approved → synced_to_xero
                              ↘ failed (Xero push error - retryable)
unmatched (no active contract or no matching pricing_rate row - requires manual intervention)
```

### `pricing_contracts.is_active`

Managed automatically by the application based on `effective_from` and `effective_to` relative to the current date. Not toggled manually except via the deactivation flow in the AR contract management UI.
