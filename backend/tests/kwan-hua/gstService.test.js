jest.mock('../../src/models', () => ({ GstRate: { findOne: jest.fn() } }))

const { Op } = require('sequelize')
const { GstRate } = require('../../src/models')
const gstService = require('../../src/services/gstService')

beforeEach(() => jest.clearAllMocks())

describe('gstService', () => {
  test('selects the effective-dated Singapore rate and returns an invoice snapshot', async () => {
    GstRate.findOne.mockResolvedValue({ id: 3, rate_percent: '9.00', xero_tax_type: 'OUTPUT' })

    const snapshot = await gstService.buildSnapshot('2026-08-06')

    expect(snapshot).toEqual({
      gst_rate_id: 3,
      gst_rate_percent: 9,
      gst_effective_date: '2026-08-06',
      xero_tax_type: 'OUTPUT',
    })
    expect(GstRate.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        jurisdiction: 'SG',
        is_active: true,
        effective_from: { [Op.lte]: '2026-08-06' },
      }),
      order: [['effective_from', 'DESC']],
    }))
  })

  test('stops billing when no verified rate covers the tax date', async () => {
    GstRate.findOne.mockResolvedValue(null)
    await expect(gstService.buildSnapshot('2028-01-01')).rejects.toMatchObject({ code: 'GST_RATE_NOT_CONFIGURED' })
  })

  test('calculates GST per exclusive line and freezes a two-decimal invoice total', () => {
    const totals = gstService.calculateTotals([
      { amount: 10.06 },
      { amount: 20.05 },
    ], 9)

    expect(totals).toEqual({ subtotal: 30.11, tax_amount: 2.71, total_amount: 32.82 })
  })

  test('rejects an invalid tax date instead of guessing a rate', async () => {
    await expect(gstService.buildSnapshot('not-a-date')).rejects.toMatchObject({ code: 'INVALID_GST_DATE' })
    expect(GstRate.findOne).not.toHaveBeenCalled()
  })
})
