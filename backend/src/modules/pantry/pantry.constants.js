export const PANTRY_STATES =
  Object.freeze([
    'confirmed_available',
    'inferred_available',
    'running_low',
    'uncertain',
    'out',
    'replenished_elsewhere',
    'do_not_track',
  ])

export const PANTRY_QUANTITY_MODES =
  Object.freeze([
    'exact',
    'range',
    'unknown',
  ])

export const PANTRY_STORAGE_ZONES =
  Object.freeze([
    'pantry',
    'fridge',
    'freezer',
    'other',
  ])

export const PANTRY_OBSERVATION_SOURCES =
  Object.freeze([
    'manual_have',
    'manual_quantity_correction',
    'marketplace_purchase',
    'external_purchase_confirmation',
    'barcode_capture',
    'product_photo',
    'shelf_photo',
    'receipt_import',
    'commerce_email_history',
    'recipe_consumption',
    'running_low_confirmation',
    'bought_elsewhere',
    'opened',
    'finished',
    'discard_expiry',
    'storage_update',
    'planned_use',
    'use_soon',
    'do_not_track',
    'resume_tracking',
    'inference',
  ])

/*
|--------------------------------------------------------------------------
| Customer-controlled Observation Sources
|--------------------------------------------------------------------------
|
| Browser/customer API may create only these.
|
| Purchase confirmation, receipt ingestion, email-history ingestion and
| automated inference must come from trusted backend integrations later.
|
*/

export const PANTRY_CUSTOMER_OBSERVATION_SOURCES =
  Object.freeze([
    'manual_have',
    'manual_quantity_correction',
    'running_low_confirmation',
    'bought_elsewhere',
    'opened',
    'finished',
    'discard_expiry',
    'storage_update',
    'planned_use',
    'use_soon',
    'do_not_track',
    'resume_tracking',
  ])

export const PANTRY_SYSTEM_OBSERVATION_SOURCES =
  Object.freeze(
    PANTRY_OBSERVATION_SOURCES.filter(
      (
        source,
      ) =>
        !PANTRY_CUSTOMER_OBSERVATION_SOURCES.includes(
          source,
        ),
    ),
  )

export const PANTRY_QUANTITY_UNITS =
  Object.freeze([
    'mg',
    'g',
    'kg',

    'ml',
    'l',

    'tsp',
    'tbsp',
    'cup',

    'piece',
    'slice',
    'clove',
    'bunch',

    'pinch',
  ])

/*
|--------------------------------------------------------------------------
| Evidence Strength
|--------------------------------------------------------------------------
|
| Story SRS rule:
|
| Customer correction > reliable purchase signal > inference.
|
| Numbers are ordering weights only.
|
*/

export const PANTRY_EVIDENCE_STRENGTH =
  Object.freeze({
    manual_quantity_correction:
      100,

    finished:
      100,

    discard_expiry:
      100,

    do_not_track:
      100,

    manual_have:
      95,

    running_low_confirmation:
      95,

    bought_elsewhere:
      95,

    resume_tracking:
      95,

    opened:
      90,

    storage_update:
      90,

    planned_use:
      90,

    use_soon:
      90,

    marketplace_purchase:
      80,

    external_purchase_confirmation:
      78,

    recipe_consumption:
      75,

    receipt_import:
      70,

    commerce_email_history:
      70,

    barcode_capture:
      65,

    product_photo:
      60,

    shelf_photo:
      60,

    inference:
      40,
  })

/*
|--------------------------------------------------------------------------
| Initial Confidence
|--------------------------------------------------------------------------
|
| Deterministic baseline only.
|
| This is not represented to customers as an exact probability guarantee.
|
*/

export const PANTRY_BASE_CONFIDENCE =
  Object.freeze({
    manual_quantity_correction:
      1,

    finished:
      1,

    discard_expiry:
      1,

    do_not_track:
      1,

    manual_have:
      0.98,

    running_low_confirmation:
      0.98,

    bought_elsewhere:
      0.98,

    resume_tracking:
      0.95,

    opened:
      0.95,

    storage_update:
      0.95,

    planned_use:
      0.9,

    use_soon:
      0.9,

    marketplace_purchase:
      0.9,

    external_purchase_confirmation:
      0.88,

    recipe_consumption:
      0.85,

    receipt_import:
      0.82,

    commerce_email_history:
      0.8,

    barcode_capture:
      0.78,

    product_photo:
      0.72,

    shelf_photo:
      0.7,

    inference:
      0.65,
  })

/*
|--------------------------------------------------------------------------
| Confidence Half-life
|--------------------------------------------------------------------------
|
| Explicit customer state decays more slowly than inferred state.
|
| Terminal states and do-not-track do not decay into another state.
|
*/

export const PANTRY_CONFIDENCE_HALF_LIFE_DAYS =
  Object.freeze({
    manual_quantity_correction:
      90,

    manual_have:
      60,

    running_low_confirmation:
      30,

    bought_elsewhere:
      60,

    resume_tracking:
      60,

    opened:
      60,

    storage_update:
      90,

    planned_use:
      30,

    use_soon:
      21,

    marketplace_purchase:
      30,

    external_purchase_confirmation:
      30,

    recipe_consumption:
      21,

    receipt_import:
      21,

    commerce_email_history:
      21,

    barcode_capture:
      21,

    product_photo:
      14,

    shelf_photo:
      14,

    inference:
      7,
  })

export const PANTRY_UNCERTAIN_CONFIDENCE_THRESHOLD =
  0.45

export const PANTRY_TERMINAL_NON_DECAY_STATES =
  Object.freeze([
    'out',
    'do_not_track',
  ])

export function isKnownPantryState(
  value,
) {
  return PANTRY_STATES.includes(
    value,
  )
}

export function isKnownPantryObservationSource(
  value,
) {
  return PANTRY_OBSERVATION_SOURCES.includes(
    value,
  )
}

export function getPantryEvidenceStrength(
  sourceType,
) {
  return (
    PANTRY_EVIDENCE_STRENGTH[
      sourceType
    ] ??
    0
  )
}

export function getPantryBaseConfidence(
  sourceType,
) {
  return (
    PANTRY_BASE_CONFIDENCE[
      sourceType
    ] ??
    0
  )
}

export function getPantryConfidenceHalfLifeDays(
  sourceType,
) {
  return (
    PANTRY_CONFIDENCE_HALF_LIFE_DAYS[
      sourceType
    ] ??
    null
  )
}