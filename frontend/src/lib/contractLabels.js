// Display labels for the pricing contract enums (validation/contractValidation.js holds
// the actual enum values shared with the backend). Kept separate from validation since
// these are presentation-only and never sent to the API.
export const SERVICE_TYPE_LABELS = { eas: 'EAS', mts: 'MTS', event_standby: 'Event Standby', workplace_standby: 'Workplace Standby' }

export const TRANSFER_TYPE_LABELS = {
  one_way_hospital: 'One-Way Hospital', two_way_hospital: 'Two-Way Hospital', covid_19: 'COVID-19',
  imh_psychiatric: 'IMH Psychiatric', airport_no_tarmac: 'Airport (No Tarmac)', airport_with_tarmac: 'Airport (With Tarmac)',
  sg_jb_ground: 'SG-JB Ground', air_evacuation: 'Air Evacuation', standby: 'Manpower Standby (No Transfer)',
}

export const TIME_OF_DAY_LABELS = {
  office_hours: 'Office Hours', non_office_hours: 'Non-Office Hours', all_hours: 'All Hours',
}

// Order matches design/jasper/database-schema.md's published surcharge schedule -
// also the order seed-pricing.js creates rows in, so a freshly-seeded contract's
// surcharge card reads top-to-bottom in this same sequence.
export const SURCHARGE_TYPE_LABELS = {
  oxygen_base: 'Oxygen Base',
  oxygen_per_litre: 'Oxygen Per Litre (>10L)',
  inconvenience_fee: 'Inconvenience Fee',
  disposables_base: 'Disposables Base',
  resuscitation: 'Resuscitation',
  suction: 'Suction',
  waiting_time_per_30min: 'Waiting Time (per 30 min)',
  heavy_lifting_min: 'Heavy Lifting (min)',
  heavy_lifting_max: 'Heavy Lifting (max)',
  jurong_island_min: 'Jurong Island (min)',
  jurong_island_max: 'Jurong Island (max)',
  overtime_per_hour: 'Overtime (per hour)',
  cancellation: 'Cancellation Fee',
}

// is_active means "not manually withdrawn / not lapsed" (see backend/src/controllers/
// contractController.js's computeIsActive) - it is NOT "currently within the effective
// date range". The backend only ever sets is_active=false automatically for one reason:
// the contract has lapsed (effective_to is in the past). So if is_active is false BUT
// effective_to is still today or later, the only way that combination can exist is a
// manual Deactivate action - the automatic path would never have produced it. That
// lets a fourth, UI-only "deactivated" state be derived without any new backend field:
//   is_active=false, effective_to < today   -> "expired" (naturally lapsed)
//   is_active=false, effective_to >= today  -> "deactivated" (manually withdrawn early)
//   is_active=true,  not started yet        -> "upcoming"
//   is_active=true,  in range               -> "active"
//   is_active=true,  past end (stale read)  -> "expired" (defensive - the backend would
//                                              correct this to false on the next edit)
export function getContractDisplayStatus(contract) {
  const today = new Date().toISOString().slice(0, 10)
  if (!contract.is_active) return contract.effective_to < today ? 'expired' : 'deactivated'
  if (contract.effective_to < today) return 'expired'
  if (contract.effective_from > today) return 'upcoming'
  return 'active'
}

// Sensible starting amounts so the create form's surcharge section isn't all blanks -
// AR staff can override any of these before saving, so this is a UX convenience, not a
// source of truth (the DB row created on submit is). It's NOT shared code with
// backend/src/scripts/seed-pricing.js's SURCHARGES array - a Vite frontend and a Node
// backend script can't import a common module without new shared-package tooling, so
// these are two independently-typed copies of the same published figures. If you
// change a rate in one, check the other - there's no build-time check that would catch
// them drifting apart, only this comment.
export const SURCHARGE_DEFAULT_AMOUNTS = {
  oxygen_base: 50, oxygen_per_litre: 1, inconvenience_fee: 50, disposables_base: 20,
  resuscitation: 320, suction: 50, waiting_time_per_30min: 30,
  heavy_lifting_min: 50, heavy_lifting_max: 150,
  jurong_island_min: 150, jurong_island_max: 200,
  overtime_per_hour: 45,
  cancellation: 100,
}
