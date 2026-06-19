```mermaid
erDiagram
    roles {
        INTEGER id PK
        STRING name
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    users {
        INTEGER id PK
        INTEGER role_id FK
        STRING name
        STRING email
        STRING password_hash
        BOOLEAN is_active
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    clients {
        INTEGER id PK
        STRING name
        STRING contact_name
        STRING contact_email
        STRING contact_phone
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    intake_submissions {
        INTEGER id PK
        INTEGER client_id FK
        INTEGER reviewed_by FK
        STRING submitted_by_name
        STRING submitted_by_email
        STRING submitted_by_phone
        STRING event_type
        DATEONLY event_date
        STRING event_location
        STRING service_tier
        TEXT additional_notes
        STRING status
        TEXT rejection_reason
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    bookings {
        INTEGER id PK
        INTEGER intake_submission_id FK
        INTEGER client_id FK
        INTEGER assigned_crew_id FK
        INTEGER confirmed_by FK
        STRING service_tier
        DATEONLY scheduled_date
        STRING location
        STRING status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    service_memos {
        INTEGER id PK
        INTEGER booking_id FK
        INTEGER submitted_by FK
        INTEGER reviewed_by FK
        DATE job_start_time
        DATE job_end_time
        DECIMAL overtime_hours
        INTEGER evacuation_floors
        STRING patient_name
        STRING hospital_destination
        TEXT additional_charges_notes
        STRING hospital_stamp_image_url
        STRING status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    memo_signatures {
        INTEGER id PK
        INTEGER memo_id FK
        STRING signer_name
        STRING signature_image_url
        DATE signed_at
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    pricing_contracts {
        INTEGER id PK
        INTEGER client_id FK
        INTEGER created_by FK
        STRING contract_name
        DATEONLY effective_from
        DATEONLY effective_to
        BOOLEAN is_active
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    pricing_rules {
        INTEGER id PK
        INTEGER contract_id FK
        STRING rule_type
        STRING service_tier
        DECIMAL unit_price
        STRING description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    invoices {
        INTEGER id PK
        INTEGER memo_id FK
        INTEGER booking_id FK
        INTEGER client_id FK
        INTEGER contract_id FK
        INTEGER approved_by FK
        DECIMAL subtotal
        DECIMAL tax_amount
        DECIMAL total_amount
        STRING status
        STRING xero_invoice_id
        DATE approved_at
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    invoice_line_items {
        INTEGER id PK
        INTEGER invoice_id FK
        STRING description
        DECIMAL quantity
        DECIMAL unit_price
        DECIMAL amount
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    vendor_invoices {
        INTEGER id PK
        INTEGER uploaded_by FK
        INTEGER approved_by FK
        STRING vendor_name
        STRING invoice_number
        DATEONLY invoice_date
        STRING pdf_url
        DECIMAL extracted_total
        DECIMAL verified_total
        DECIMAL rebate_percentage
        DECIMAL rebate_amount
        FLOAT extraction_confidence
        BOOLEAN is_low_confidence
        STRING status
        STRING xero_bill_id
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    vendor_invoice_items {
        INTEGER id PK
        INTEGER vendor_invoice_id FK
        STRING description
        DECIMAL quantity
        DECIMAL unit_price
        DECIMAL amount
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    xero_sync_logs {
        INTEGER id PK
        STRING entity_type
        INTEGER entity_id
        STRING xero_record_id
        STRING status
        INTEGER attempt_count
        TEXT error_message
        DATE synced_at
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    roles ||--o{ users : "has"
    users ||--o{ intake_submissions : "reviews"
    clients ||--o{ intake_submissions : "linked to"
    intake_submissions ||--o| bookings : "creates"
    clients ||--o{ bookings : "has"
    users ||--o{ bookings : "assigned as crew"
    users ||--o{ bookings : "confirmed by"
    bookings ||--o| service_memos : "generates"
    users ||--o{ service_memos : "submitted by"
    users ||--o{ service_memos : "reviewed by"
    service_memos ||--o{ memo_signatures : "has"
    clients ||--o{ pricing_contracts : "has"
    users ||--o{ pricing_contracts : "created by"
    pricing_contracts ||--o{ pricing_rules : "contains"
    service_memos ||--o| invoices : "matched to"
    bookings ||--o| invoices : "billed as"
    clients ||--o{ invoices : "billed to"
    pricing_contracts ||--o{ invoices : "applied to"
    users ||--o{ invoices : "approved by"
    invoices ||--o{ invoice_line_items : "contains"
    users ||--o{ vendor_invoices : "uploaded by"
    users ||--o{ vendor_invoices : "approved by"
    vendor_invoices ||--o{ vendor_invoice_items : "contains"
```
