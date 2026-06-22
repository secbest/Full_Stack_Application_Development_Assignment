# Database Schema - Liang Yi

**Feature Area:** Field Operations & Executive Dashboard

---

## Tables Owned

- `service_memos`
- `memo_signatures`

## Foreign Key Dependencies from Teammates

| Column | References | Owner |
|--------|-----------|-------|
| `service_memos.booking_id` | `bookings.id` | Zheng Bao |
| `service_memos.submitted_by` | `users.id` | Group (shared) |
| `service_memos.reviewed_by` | `users.id` | Group (shared) |

## Executive Dashboard Read Dependencies (no tables owned)

The UC-06 fleet overview and UC-07 overhead summary are read-only aggregations. No new tables are needed - the dashboard queries data from tables owned by teammates:

| Data Needed | Source Table | Owner |
|------------|-------------|-------|
| Booking status counts (UC-06) | `bookings` | Zheng Bao |
| Invoices synced to Xero count (UC-06) | `invoices` | Jasper |
| Vendor expenditure totals (UC-07) | `vendor_invoices` | Kwan Hua |
| Memos pending submission count (UC-06) | `service_memos` | Liang Yi (self) |

---

## Table: `service_memos`

Stores the digital field memos created by ambulance crew after each job. One memo per booking is enforced via a unique constraint on `booking_id`. The record is only written to the database on final submission (UC-05) - drafts are cached in browser local storage and never persisted as partial records.

The pricing engine fields (`service_type` through `is_jurong_island`) are required by Jasper's AR pricing engine to calculate the invoice from this memo. All of these fields must be present and validated before the memo status can advance to `reviewed`.

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `booking_id` | `DataTypes.INTEGER` | NOT NULL, Unique, Foreign Key → `bookings.id` |
| `submitted_by` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `users.id` |
| `reviewed_by` | `DataTypes.INTEGER` | allowNull: true, Foreign Key → `users.id` |
| `job_start_time` | `DataTypes.DATE` | NOT NULL |
| `job_end_time` | `DataTypes.DATE` | NOT NULL |
| `overtime_hours` | `DataTypes.DECIMAL(5, 2)` | NOT NULL, Default: `0.00` |
| `evacuation_floors` | `DataTypes.INTEGER` | NOT NULL, Default: `0` |
| `patient_name` | `DataTypes.STRING(255)` | NOT NULL |
| `hospital_destination` | `DataTypes.STRING(255)` | NOT NULL |
| `additional_charges_notes` | `DataTypes.TEXT` | allowNull: true |
| `hospital_stamp_image_url` | `DataTypes.STRING(512)` | allowNull: true |
| `service_type` | `DataTypes.ENUM('eas', 'mts', 'event_standby', 'workplace_standby')` | NOT NULL |
| `transfer_type` | `DataTypes.ENUM('one_way_hospital', 'two_way_hospital', 'covid_19', 'imh_psychiatric', 'airport_no_tarmac', 'airport_with_tarmac', 'sg_jb_ground', 'air_evacuation')` | NOT NULL |
| `is_office_hours` | `DataTypes.BOOLEAN` | NOT NULL |
| `oxygen_litres_used` | `DataTypes.DECIMAL(5, 2)` | NOT NULL, Default: `0.00` |
| `has_inconvenience_fee` | `DataTypes.BOOLEAN` | NOT NULL, Default: `false` |
| `disposables_used` | `DataTypes.BOOLEAN` | NOT NULL, Default: `false` |
| `resuscitation_performed` | `DataTypes.BOOLEAN` | NOT NULL, Default: `false` |
| `suction_performed` | `DataTypes.BOOLEAN` | NOT NULL, Default: `false` |
| `waiting_time_minutes` | `DataTypes.INTEGER` | NOT NULL, Default: `0` |
| `patient_weight_kg` | `DataTypes.DECIMAL(5, 1)` | allowNull: true |
| `is_jurong_island` | `DataTypes.BOOLEAN` | NOT NULL, Default: `false` |
| `status` | `DataTypes.ENUM('submitted', 'reviewed', 'invoiced')` | NOT NULL, Default: `'submitted'` |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Pricing Engine Field Notes (Cross-Team Dependency - Jasper)

These fields are required by Jasper's AR pricing engine. The ENUM values match the corresponding ENUM values in `pricing_rates` and `surcharge_schedules` exactly so that the engine can look up the correct row without transformation.

| Field | Used By Pricing Engine For |
|-------|---------------------------|
| `service_type` | Base rate row lookup |
| `transfer_type` | Base rate row lookup |
| `is_office_hours` | Time-of-day rate selection |
| `oxygen_litres_used` | Oxygen surcharge calculation (base + per-litre above 10L) |
| `has_inconvenience_fee` | Flat $50 inconvenience surcharge |
| `disposables_used` | Minimum $20 disposables charge |
| `resuscitation_performed` | Flat $320 resuscitation surcharge |
| `suction_performed` | Flat $50 suction surcharge |
| `waiting_time_minutes` | Per-30-min waiting block charge |
| `patient_weight_kg` | Heavy lifting surcharge trigger (≥90 kg) |
| `is_jurong_island` | Jurong Island transport surcharge |

### Sequelize Model

```js
ServiceMemo.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: 'bookings', key: 'id' },
  },
  submitted_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  reviewed_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  job_start_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  job_end_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  overtime_hours: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  evacuation_floors: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  patient_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  hospital_destination: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  additional_charges_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  hospital_stamp_image_url: {
    type: DataTypes.STRING(512),
    allowNull: true,
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
  is_office_hours: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  oxygen_litres_used: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  has_inconvenience_fee: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  disposables_used: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  resuscitation_performed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  suction_performed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  waiting_time_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  patient_weight_kg: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: true,
  },
  is_jurong_island: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  status: {
    type: DataTypes.ENUM('submitted', 'reviewed', 'invoiced'),
    allowNull: false,
    defaultValue: 'submitted',
  },
}, { sequelize, modelName: 'ServiceMemo', tableName: 'service_memos', underscored: true })
```

### Associations

```js
ServiceMemo.belongsTo(Booking, { foreignKey: 'booking_id' })
ServiceMemo.belongsTo(User, { foreignKey: 'submitted_by', as: 'submittedBy' })
ServiceMemo.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewedBy' })
ServiceMemo.hasMany(MemoSignature, { foreignKey: 'memo_id', onDelete: 'CASCADE' })
ServiceMemo.hasOne(Invoice, { foreignKey: 'memo_id' })
```

---

## Table: `memo_signatures`

Stores the handover signature captured on the field memo form (UC-02). Allows multiple rows per memo to support jobs where both a patient and a crew supervisor sign. The `is_waived` flag covers the UC-02 edge case where a patient is unable to sign (e.g. unconscious transfer) - a waiver row is inserted with `is_waived = true`, `signature_image_url = null`, and a mandatory `waiver_reason`. The `signed_at` timestamp is stored as a full datetime to serve as the immutable audit record referenced in UC-02.

| Field | Sequelize Type | Constraints |
|-------|---------------|-------------|
| `id` | `DataTypes.INTEGER` | Primary Key, Auto Increment |
| `memo_id` | `DataTypes.INTEGER` | NOT NULL, Foreign Key → `service_memos.id`, onDelete: CASCADE |
| `signer_name` | `DataTypes.STRING(255)` | NOT NULL |
| `signature_image_url` | `DataTypes.STRING(512)` | allowNull: true |
| `signed_at` | `DataTypes.DATE` | NOT NULL |
| `is_waived` | `DataTypes.BOOLEAN` | NOT NULL, Default: `false` |
| `waiver_reason` | `DataTypes.TEXT` | allowNull: true |
| `created_at` | `DataTypes.DATE` | Auto-managed by Sequelize |
| `updated_at` | `DataTypes.DATE` | Auto-managed by Sequelize |

### Sequelize Model

```js
MemoSignature.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  memo_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'service_memos', key: 'id' },
    onDelete: 'CASCADE',
  },
  signer_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  signature_image_url: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  signed_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  is_waived: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  waiver_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, { sequelize, modelName: 'MemoSignature', tableName: 'memo_signatures', underscored: true })
```

### Associations

```js
MemoSignature.belongsTo(ServiceMemo, { foreignKey: 'memo_id' })
```

---

## Status Flow Reference

### `service_memos.status`

```
submitted ──► reviewed ──► invoiced
```

- `submitted` - set by the field crew on UC-05 final submission
- `reviewed` - set by Sarah (AR Specialist) after validating the memo (Jasper's AR feature)
- `invoiced` - set by Jasper's pricing engine after a matching invoice record is created

### `bookings.status` (Zheng Bao's table - referenced by UC-05)

UC-05 step 5 updates the linked booking status from `in_progress` to `completed` on memo submission. This write is made by Liang Yi's memo submission controller to Zheng Bao's `bookings` table.

---

## Validation Rules for Revenue Fields (UC-03)

These rules are enforced at the application layer on the memo submission form before the record is created in the database.

| Field | Rule |
|-------|------|
| `job_start_time` | Required; must be before `job_end_time` |
| `job_end_time` | Required; must be after `job_start_time` |
| `overtime_hours` | Must be ≥ 0; cannot be 0 if `job_end_time` exceeds scheduled duration by more than 30 minutes without a reason in `additional_charges_notes` |
| `evacuation_floors` | Must be ≥ 0; cannot be null (crew must explicitly enter 0 if none occurred) |
| `patient_name` | Required |
| `hospital_destination` | Required |
| `service_type` | Required; must match a valid ENUM value |
| `transfer_type` | Required; must match a valid ENUM value |
