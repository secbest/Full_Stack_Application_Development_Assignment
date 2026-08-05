// Owner: Jasper. Unit tests for the notification read API - the missing half of a
// feature that already writes rows (notificationService.create, called from five other
// controllers) but had no way to read them back. Ownership is always req.user.sub; no
// route accepts a user id, so one user can never read or mutate another's notifications.
jest.mock('../../src/models', () => ({
  Notification: {
    findAll: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
}))

const { Notification } = require('../../src/models')
const {
  listNotifications, getUnreadCount, markAsRead, markAllAsRead,
} = require('../../src/controllers/notificationController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function mockReq({ sub = 5, query = {}, params = {} } = {}) {
  return { user: { sub }, query, params }
}

beforeEach(() => jest.clearAllMocks())

describe('listNotifications', () => {
  test('scopes to the caller only, newest first', async () => {
    Notification.findAll.mockResolvedValue([
      { id: 2, type: 'job_assigned', title: 'New job assigned', body: null, link: '/jobs', is_read: false, createdAt: new Date('2026-08-05T02:00:00Z') },
    ])

    const res = mockRes()
    await listNotifications(mockReq({ sub: 5 }), res)

    expect(Notification.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 5 },
      order: [['created_at', 'DESC']],
    }))
    expect(payload(res).data).toHaveLength(1)
    expect(payload(res).data[0]).toMatchObject({ id: 2, type: 'job_assigned', is_read: false })
  })

  test('unread_only=true adds is_read: false to the where clause', async () => {
    Notification.findAll.mockResolvedValue([])

    const res = mockRes()
    await listNotifications(mockReq({ sub: 5, query: { unread_only: 'true' } }), res)

    expect(Notification.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 5, is_read: false },
    }))
  })

  test('clamps invalid limits to a safe range', async () => {
    Notification.findAll.mockResolvedValue([])

    const negativeRes = mockRes()
    await listNotifications(mockReq({ query: { limit: '-20' } }), negativeRes)
    expect(Notification.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 1 }))

    const excessiveRes = mockRes()
    await listNotifications(mockReq({ query: { limit: '5000' } }), excessiveRes)
    expect(Notification.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50 }))

    const malformedRes = mockRes()
    await listNotifications(mockReq({ query: { limit: 'not-a-number' } }), malformedRes)
    expect(Notification.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20 }))
  })
})

describe('getUnreadCount', () => {
  test('returns the count scoped to the caller', async () => {
    Notification.count.mockResolvedValue(3)

    const res = mockRes()
    await getUnreadCount(mockReq({ sub: 5 }), res)

    expect(Notification.count).toHaveBeenCalledWith({ where: { user_id: 5, is_read: false } })
    expect(payload(res).data).toEqual({ count: 3 })
  })
})

describe('markAsRead', () => {
  test('404s when the notification is not owned by the caller (blurred with "does not exist")', async () => {
    Notification.findOne.mockResolvedValue(null)

    const res = mockRes()
    await markAsRead(mockReq({ sub: 5, params: { id: 99 } }), res)

    expect(Notification.findOne).toHaveBeenCalledWith({ where: { id: 99, user_id: 5 } })
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('rejects a malformed id before querying PostgreSQL', async () => {
    const res = mockRes()
    await markAsRead(mockReq({ sub: 5, params: { id: 'not-a-number' } }), res)

    expect(Notification.findOne).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('VALIDATION_ERROR')
  })

  test('marks the caller\'s own notification read', async () => {
    const notification = { id: 1, update: jest.fn().mockResolvedValue() }
    Notification.findOne.mockResolvedValue(notification)

    const res = mockRes()
    await markAsRead(mockReq({ sub: 5, params: { id: 1 } }), res)

    expect(notification.update).toHaveBeenCalledWith({ is_read: true })
    expect(payload(res).data).toEqual({ id: 1, is_read: true })
  })
})

describe('markAllAsRead', () => {
  test('updates only the caller\'s unread rows', async () => {
    Notification.update.mockResolvedValue([2])

    const res = mockRes()
    await markAllAsRead(mockReq({ sub: 5 }), res)

    expect(Notification.update).toHaveBeenCalledWith(
      { is_read: true },
      { where: { user_id: 5, is_read: false } }
    )
    expect(payload(res).data).toEqual({ marked_read: true })
  })
})
