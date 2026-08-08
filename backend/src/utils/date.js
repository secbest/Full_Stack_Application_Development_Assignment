// Calendar-day helpers. EFAR operates only in Singapore (UTC+8, no DST).
//
// These live in one place because the same defect was written twice independently - once
// in dashboardController and once in bookingController - and shipped both times. Both
// copies formatted a local-midnight Date with `.toISOString().slice(0, 10)`, which
// converts to UTC first. In Singapore local midnight is 16:00 the PREVIOUS day in UTC, so
// the calendar day silently moved back by one: the MD dashboard reported yesterday's
// figures, and the Field Crew's Today/Tomorrow/This Week tabs listed the wrong day's jobs.
//
// Import these rather than re-deriving them. A date helper that is "obviously right" is
// exactly the kind that gets copy-pasted with its bug intact.

// The calendar day a Date falls on in SERVER-LOCAL time, as YYYY-MM-DD.
//
// Never use toISOString() for this. Use it only when you genuinely want the UTC instant.
function toDateOnly(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Midnight at the start of the given date, in server-local time.
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// Today's calendar day, server-local. The common case, spelled out so callers do not have
// to remember that `toDateOnly(new Date())` is the correct form and
// `new Date().toISOString().slice(0, 10)` is not.
function today() {
  return toDateOnly(new Date())
}

module.exports = { toDateOnly, startOfDay, today }
