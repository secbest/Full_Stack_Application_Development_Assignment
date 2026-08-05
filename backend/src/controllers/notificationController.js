// Owner: Jasper. Read API for the Notification model - notificationService.create()
// and its seven write sites across five controllers already exist; this is what makes
// those writes readable. Every route is authenticated and every query is scoped to
// req.user.sub - no route accepts a user id, so one user can never read or mutate
// another's notifications.
const { Notification } = require('../models')
const { success, error, notFound } = require('../utils')

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

function serialize(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    is_read: n.is_read,
    // Notification has underscored: true with no explicit created_at field, so
    // Sequelize exposes the timestamp as the camelCase createdAt property - reading
    // n.created_at here would silently serialize as undefined (see the identical bug
    // and fix in serviceMemoController.js's created_at handling).
    created_at: n.createdAt,
  }
}

async function listNotifications(req, res) {
  try {
    const { unread_only, limit } = req.query
    const where = { user_id: req.user.sub }
    if (unread_only === 'true') where.is_read = false

    const parsedLimit = Math.min(parseInt(limit, 10) || DEFAULT_LIMIT, MAX_LIMIT)
    const notifications = await Notification.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parsedLimit,
    })

    return success(res, notifications.map(serialize))
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function getUnreadCount(req, res) {
  try {
    const count = await Notification.count({ where: { user_id: req.user.sub, is_read: false } })
    return success(res, { count })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function markAsRead(req, res) {
  try {
    const notification = await Notification.findOne({ where: { id: String(req.params.id), user_id: req.user.sub } })
    if (!notification) return notFound(res, 'Notification not found.')
    await notification.update({ is_read: true })
    return success(res, { id: notification.id, is_read: true })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function markAllAsRead(req, res) {
  try {
    await Notification.update({ is_read: true }, { where: { user_id: req.user.sub, is_read: false } })
    return success(res, { marked_read: true })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { listNotifications, getUnreadCount, markAsRead, markAllAsRead }
