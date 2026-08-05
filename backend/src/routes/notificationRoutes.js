const router = require('express').Router()
const { authenticate } = require('../middleware')
const {
  listNotifications, getUnreadCount, markAsRead, markAllAsRead,
} = require('../controllers/notificationController')

// No authorise() - every authenticated role reads/marks only its own notifications,
// the same self-service pattern as PATCH /users/me (userRoutes.js).
// Specific paths declared before /:id so a literal segment is never captured as an id.
router.get('/unread-count', authenticate, getUnreadCount)
router.get('/', authenticate, listNotifications)
router.patch('/read-all', authenticate, markAllAsRead)
router.patch('/:id/read', authenticate, markAsRead)

module.exports = router
