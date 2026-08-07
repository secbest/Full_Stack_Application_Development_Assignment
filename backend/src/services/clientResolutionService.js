// Owner: Kwan Hua.
//
// Resolves the Client record an approved intake submission belongs to.
//
// Why this exists: confirmIntake used to do
//
//   Client.findOrCreate({ where: { contact_email }, defaults: { name: organisation, ... } })
//
// which makes the EMAIL the client's identity. Sequelize's findOrCreate returns the
// existing row untouched when the where-clause matches, so `defaults` - including the
// organisation the specialist actually typed - was silently discarded. Confirming an
// intake for "NUS" while reusing an email already on file for "Nanyang Poly" produced a
// booking billed to Nanyang Poly, with no warning anywhere.
//
// For a B2B booking the ORGANISATION is the customer, so it is the identity key. Email is
// a contact detail: one organisation legitimately has many staff emails, and one shared
// mailbox can legitimately book for several organisations. Individual (non-organisation)
// customers keep the email key, which is the correct identity when there is no company.

const { Op } = require('sequelize')
const { Client } = require('../models')

// Case- and whitespace-insensitive comparison key. Deliberately conservative: it does not
// try to equate "Poly"/"Polytechnic" or strip "Pte Ltd", because silently merging two
// genuinely different customers is far worse than creating a duplicate a human can merge.
function normaliseName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ')
}

// `%` and `_` are wildcards in iLike; an organisation containing either would otherwise
// match far more rows than intended.
function escapeLikeWildcards(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Finds (or creates) the Client for a confirmed intake submission.
 *
 * Organisation bookings match on normalised organisation name; individual bookings match
 * on contact email. Returns { client, created, matchedBy }.
 *
 * @param {object} intake - the IntakeSubmission row being confirmed.
 * @param {object} [options]
 * @param {object} [options.transaction] - optional Sequelize transaction.
 */
async function resolveClientForIntake(intake, { transaction } = {}) {
  const organisation = normaliseName(intake.organisation)
  const contactEmail = intake.contact_email
  const contactPhone = intake.contact_phone

  // Individual customer - no organisation to identify them by, so email remains the key.
  if (!organisation) {
    const [client, created] = await Client.findOrCreate({
      where: { contact_email: contactEmail },
      defaults: {
        name: normaliseName(intake.customer_name) || contactEmail,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      },
      transaction,
    })
    return { client, created, matchedBy: created ? 'created' : 'contact_email' }
  }

  // Organisation booking - iLike with no wildcards is a case-insensitive equality test.
  const existing = await Client.findOne({
    where: { name: { [Op.iLike]: escapeLikeWildcards(organisation) } },
    transaction,
  })
  if (existing) return { client: existing, created: false, matchedBy: 'organisation' }

  const client = await Client.create({
    name: organisation,
    contact_email: contactEmail,
    contact_phone: contactPhone,
  }, { transaction })
  return { client, created: true, matchedBy: 'created' }
}

module.exports = { resolveClientForIntake, normaliseName }
