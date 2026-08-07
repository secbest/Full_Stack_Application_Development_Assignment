// Owner: Kwan Hua.
//
// EFAR's published pricing table, transcribed for use as on-screen guidance when the
// Quotations Specialist agrees a one-off base price.
//
// Why this exists: the Agreed Base Price field was a bare numeric input with a "0.00"
// placeholder and no reference to any rate card, so the specialist was quoting from
// memory. The result is visible in the data - bookings quoted at $50 and $100 against a
// published one-way transfer rate of $160-$210.
//
// These figures are GUIDANCE, not validation. The published table covers Medical
// Transport Services; EAS, event standby and workplace standby are negotiated separately,
// and a specialist may legitimately agree a figure outside the range. The UI therefore
// shows the range and flags an outlier - it never blocks the confirmation.

// min/max are the published band. A single published figure is stored as min === max.
// `quoteOnly: true` marks a service the table refuses to price up front ("Call for Quote").
export const PUBLISHED_BASE_RATES = {
  one_way_hospital:    { office_hours: { min: 160, max: 210 }, non_office_hours: { min: 190, max: 210 } },
  two_way_hospital:    { office_hours: { min: 210, max: 250 }, non_office_hours: { min: 280, max: 320 } },
  covid_19:            { office_hours: { min: 280, max: 280 }, non_office_hours: { min: 320, max: 320 } },
  imh_psychiatric:     { office_hours: { min: 400, max: 400 }, non_office_hours: { min: 500, max: 500 } },
  airport_no_tarmac:   { office_hours: { min: 210, max: 210 }, non_office_hours: { min: 210, max: 210 } },
  airport_with_tarmac: { office_hours: { min: 550, max: 550 }, non_office_hours: { min: 650, max: 650 } },
  // Published as a single all-hours band: "Ground Transfer (SG - JB) within 1hr checkpoint clearance".
  sg_jb_ground:        { all_hours: { min: 500, max: 900 } },
  air_evacuation:      { quoteOnly: true },
}

// The published table is headed "Medical Transport Services". Other service types are
// negotiated per client, so the range is shown as a weaker reference for them.
export const RATE_CARD_SERVICE = 'mts'

const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`

/**
 * Returns the published guidance for a transfer type + time category, or null when the
 * table does not cover the combination.
 *
 * @returns {null | { quoteOnly: true } | { min: number, max: number, label: string }}
 */
export function getPublishedRate(transferType, timeOfDay) {
  const entry = PUBLISHED_BASE_RATES[transferType]
  if (!entry) return null
  if (entry.quoteOnly) return { quoteOnly: true }

  // sg_jb_ground publishes one all-hours band; everything else splits by time of day.
  // An "all_hours" quotation against a time-split service has no single published figure,
  // so the widest defensible band is min(office, non-office) to max(office, non-office).
  const band =
    entry[timeOfDay] ||
    entry.all_hours ||
    (timeOfDay === 'all_hours' && entry.office_hours && entry.non_office_hours
      ? {
          min: Math.min(entry.office_hours.min, entry.non_office_hours.min),
          max: Math.max(entry.office_hours.max, entry.non_office_hours.max),
        }
      : null)

  if (!band) return null
  return {
    ...band,
    label: band.min === band.max ? money(band.min) : `${money(band.min)} - ${money(band.max)}`,
  }
}

/**
 * Classifies an entered amount against the published band.
 * Returns 'ok' | 'below' | 'above' | 'unknown'.
 */
export function classifyAgainstPublished(amount, transferType, timeOfDay) {
  const rate = getPublishedRate(transferType, timeOfDay)
  if (!rate || rate.quoteOnly) return 'unknown'
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) return 'unknown'
  if (value < rate.min) return 'below'
  if (value > rate.max) return 'above'
  return 'ok'
}
