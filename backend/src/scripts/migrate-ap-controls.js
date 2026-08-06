// Idempotent AP controls migration. Existing unsynced invoices are deliberately marked
// `non_gst` rather than having input GST invented from their gross total: AP must only
// claim the tax printed on a valid supplier invoice.
require('dotenv').config()
const { DataTypes, Op } = require('sequelize')
const sequelize = require('../config')
const { VendorInvoice, VendorInvoiceAudit } = require('../models')

const COLUMNS = {
  due_date: { type: DataTypes.DATEONLY, allowNull: true },
  currency_code: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'SGD' },
  supplier_gst_registration_no: { type: DataTypes.STRING(50), allowNull: true },
  gst_treatment: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'non_gst' },
  gst_rate_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'gst_rates', key: 'id' } },
  gst_rate_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  gst_effective_date: { type: DataTypes.DATEONLY, allowNull: true },
  xero_tax_type: { type: DataTypes.STRING(50), allowNull: true },
  xero_account_code: { type: DataTypes.STRING(20), allowNull: true },
  subtotal_excluding_gst: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  gst_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  total_including_gst: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
}

async function run() {
  try {
    await sequelize.authenticate()
    const qi = sequelize.getQueryInterface()
    const existing = await qi.describeTable('vendor_invoices')
    const added = []
    for (const [name, definition] of Object.entries(COLUMNS)) {
      if (!existing[name]) {
        await qi.addColumn('vendor_invoices', name, definition)
        added.push(name)
      }
    }
    await VendorInvoiceAudit.sync()

    const invoices = await VendorInvoice.findAll({
      where: {
        status: { [Op.ne]: 'synced_to_xero' },
      },
    })
    for (const invoice of invoices) {
      const total = invoice.extracted_total === null ? null : Number(invoice.extracted_total)
      const updates = {
        currency_code: invoice.currency_code || 'SGD',
        // Legacy records never captured payment terms. Invoice date is an explicit,
        // visible immediate-payment fallback; AP can replace it before first approval.
        due_date: invoice.due_date || invoice.invoice_date || null,
        xero_account_code: invoice.xero_account_code || process.env.XERO_PURCHASE_ACCOUNT_CODE || '400',
      }
      if (invoice.total_including_gst === null || invoice.total_including_gst === undefined) {
        Object.assign(updates, {
          gst_treatment: 'non_gst',
          gst_rate_id: null,
          gst_rate_percent: 0,
          gst_effective_date: invoice.invoice_date || null,
          xero_tax_type: 'NRINPUT',
          subtotal_excluding_gst: total,
          gst_amount: total === null ? null : 0,
          total_including_gst: total,
        })
      }
      await invoice.update(updates)
    }
    console.log(`[migrate-ap-controls] Complete. Added: ${added.join(', ') || 'none'}; backfilled ${invoices.length} unsynced invoice(s).`)
  } catch (err) {
    console.error('[migrate-ap-controls] Failed:', err)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

run()
