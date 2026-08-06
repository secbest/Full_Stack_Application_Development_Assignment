// Idempotent GST migration for an existing EFAR database.
//
// Adds effective-dated Singapore GST configuration and invoice snapshot columns, then
// backfills invoices that have not successfully reached Xero. Xero-synced documents are
// intentionally left untouched because changing an issued document requires an
// accounting adjustment, not an in-place rewrite. Failed invoices are included so their
// existing Retry action does not become stranded without a GST snapshot.

require('dotenv').config()
const { DataTypes, Op } = require('sequelize')
const sequelize = require('../config')
const { GstRate, Invoice, InvoiceLineItem, Booking } = require('../models')
const gstService = require('../services/gstService')

const IRAS_SOURCE = 'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/basics-of-gst/current-gst-rates'
const LEGAL_RATES = [
  { rate_percent: 7, effective_from: '2007-07-01', effective_to: '2022-12-31', xero_tax_type: 'OUTPUT', xero_input_tax_type: 'INPUT' },
  { rate_percent: 8, effective_from: '2023-01-01', effective_to: '2023-12-31', xero_tax_type: 'OUTPUTY23', xero_input_tax_type: 'INPUTY23' },
  { rate_percent: 9, effective_from: '2024-01-01', effective_to: null, xero_tax_type: 'OUTPUTY24', xero_input_tax_type: 'INPUTY24' },
]

async function addColumnIfMissing(queryInterface, columns, name, definition) {
  if (columns[name]) return false
  await queryInterface.addColumn('invoices', name, definition)
  return true
}

async function seedRates() {
  for (const legalRate of LEGAL_RATES) {
    const [rate, created] = await GstRate.findOrCreate({
      where: { jurisdiction: 'SG', effective_from: legalRate.effective_from },
      defaults: {
        ...legalRate,
        jurisdiction: 'SG',
        source_name: 'IRAS',
        source_url: IRAS_SOURCE,
        verified_at: new Date('2025-06-13T00:00:00.000Z'),
        is_active: true,
      },
    })
    if (!created) {
      // Source metadata and Xero mapping may be corrected, but the legal rate/effective
      // period is never silently overwritten after invoices may have referenced the row.
      await rate.update({
        xero_tax_type: legalRate.xero_tax_type,
        xero_input_tax_type: legalRate.xero_input_tax_type,
        source_name: 'IRAS',
        source_url: IRAS_SOURCE,
        verified_at: new Date('2025-06-13T00:00:00.000Z'),
        is_active: true,
      })
    }
  }
}

async function backfillEditableInvoices() {
  const invoices = await Invoice.findAll({
    where: {
      status: { [Op.in]: ['matched', 'adjusted', 'unmatched', 'approved', 'failed'] },
    },
    include: [
      { model: Booking, attributes: ['scheduled_date'] },
      { model: InvoiceLineItem },
    ],
  })

  let updated = 0
  for (const invoice of invoices) {
    if (!invoice.Booking || !invoice.Booking.scheduled_date) {
      console.warn(`[migrate-gst] Skipped invoice #${invoice.id}: no service date.`)
      continue
    }
    const snapshot = await gstService.buildSnapshot(invoice.Booking.scheduled_date)
    const totals = gstService.calculateTotals(invoice.InvoiceLineItems || [], snapshot.gst_rate_percent)
    await invoice.update({ ...snapshot, ...totals })
    updated += 1
  }
  return updated
}

async function run() {
  try {
    await sequelize.authenticate()
    await GstRate.sync()

    const queryInterface = sequelize.getQueryInterface()
    const rateColumns = await queryInterface.describeTable('gst_rates')
    if (!rateColumns.xero_input_tax_type) {
      await queryInterface.addColumn('gst_rates', 'xero_input_tax_type', {
        type: DataTypes.STRING(50), allowNull: false, defaultValue: 'INPUT',
      })
    }
    const columns = await queryInterface.describeTable('invoices')
    const added = []
    if (await addColumnIfMissing(queryInterface, columns, 'gst_rate_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'gst_rates', key: 'id' },
    })) added.push('gst_rate_id')
    if (await addColumnIfMissing(queryInterface, columns, 'gst_rate_percent', {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    })) added.push('gst_rate_percent')
    if (await addColumnIfMissing(queryInterface, columns, 'gst_effective_date', {
      type: DataTypes.DATEONLY,
      allowNull: true,
    })) added.push('gst_effective_date')
    if (await addColumnIfMissing(queryInterface, columns, 'xero_tax_type', {
      type: DataTypes.STRING(50),
      allowNull: true,
    })) added.push('xero_tax_type')

    await seedRates()
    const backfilled = await backfillEditableInvoices()
    console.log(`[migrate-gst] Complete. Added columns: ${added.join(', ') || 'none'}; backfilled ${backfilled} unsynced invoice(s).`)
  } catch (err) {
    console.error('[migrate-gst] Failed:', err)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

run()
