const { Notification } = require('../models')

// Creates an in-app notification. Deliberately never throws - a notification failure must
// never roll back or fail the feature that triggered it (UC-05 edge case: "Sarah's notification
// fails to send - the memo is still saved successfully; the failure is logged silently").
async function create({ user_id, type, title, body = null, link = null }) {
  try {
    return await Notification.create({ user_id, type, title, body, link })
  } catch (err) {
    console.error('[notificationService] Failed to create notification:', err.message)
    return null
  }
}

module.exports = { create }
