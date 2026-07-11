// Owner: Jasper - hotfix follow-up. NOTE: this covers a fix inside
// src/controllers/memoReviewController.js, which tests/kwan-hua/memo-review.test.js
// otherwise owns (Kwan Hua's Wave 3 AR takeover) - kept in a separate jasper-owned file
// rather than editing Kwan Hua's test file directly, since the bug and this specific fix
// (the createdAt property-name mismatch, same root cause as the serviceMemoController.js
// fix above) came out of this hotfix branch.
//
// Same root cause as serviceMemoController.js: ServiceMemo has `underscored: true` but no
// explicit created_at field, so Sequelize exposes it as `m.createdAt` (camelCase), not
// `m.created_at`. The AR review queue previously read `m.created_at`, so `submitted_at`
// silently became undefined and `hours_since_submission` became NaN (Invalid Date's
// .getTime() is NaN) for every row - meaning the "overdue" red-row highlighting in the
// Memo Review Queue (CLAUDE.md's queueColour logic) could never trigger correctly.
jest.mock('../../src/models', () => ({
  ServiceMemo: { findAndCountAll: jest.fn() },
  MemoSignature: {},
  Booking: {},
  Client: {},
  User: {},
  PricingContract: {},
  PricingRate: {},
  SurchargeSchedule: {},
  Invoice: {},
  InvoiceLineItem: {},
}))

jest.mock('../../src/config', () => ({ transaction: jest.fn((cb) => cb({})) }))
jest.mock('../../src/services', () => ({ pricingService: {} }))
jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

const { ServiceMemo } = require('../../src/models')
const { listPendingReview } = require('../../src/controllers/memoReviewController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => jest.clearAllMocks())

describe('listPendingReview - submitted_at / hours_since_submission (AR review queue)', () => {
  test('surfaces a real submitted_at and a correct hours_since_submission via m.createdAt', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
    ServiceMemo.findAndCountAll.mockResolvedValue({
      rows: [{
        id: 1, booking_id: 10, service_type: 'eas', transfer_type: 'one_way_hospital',
        Booking: { reference_number: 'BKG-TEST-00001', scheduled_date: '2026-07-05', Client: { id: 1, name: 'Raffles Medical Group' } },
        createdAt: threeHoursAgo, // real Sequelize property - deliberately no created_at set
      }],
      count: 1,
    })

    const res = mockRes()
    await listPendingReview({ query: {} }, res)

    const row = payload(res).data.data[0]
    expect(row.submitted_at).toEqual(threeHoursAgo)
    expect(row.submitted_at).not.toBeUndefined()
    expect(row.hours_since_submission).toBeCloseTo(3, 1)
    expect(Number.isNaN(row.hours_since_submission)).toBe(false)
  })
})
