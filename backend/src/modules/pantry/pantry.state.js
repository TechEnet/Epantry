import {
  getPantryBaseConfidence,
  getPantryConfidenceHalfLifeDays,
  getPantryEvidenceStrength,
  PANTRY_TERMINAL_NON_DECAY_STATES,
  PANTRY_UNCERTAIN_CONFIDENCE_THRESHOLD,
} from './pantry.constants.js'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function clamp01(
  value,
) {
  const number =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return 0
  }

  return Math.min(
    1,

    Math.max(
      0,
      number,
    ),
  )
}

function asDate(
  value,
) {
  const date =
    value instanceof
      Date
      ? value
      : new Date(
          value,
        )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      'A valid Pantry timestamp is required.',
    )
  }

  return date
}

function roundConfidence(
  value,
) {
  return Number(
    clamp01(
      value,
    ).toFixed(
      6,
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Stable Pantry Identity
|--------------------------------------------------------------------------
*/

export function buildPantryIdentityKey({
  canonicalPackId =
    null,

  canonicalIngredientId =
    null,
}) {
  const packId =
    canonicalPackId
      ? String(
          canonicalPackId,
        ).trim()
      : ''

  const ingredientId =
    canonicalIngredientId
      ? String(
          canonicalIngredientId,
        ).trim()
      : ''

  if (
    !packId &&
    !ingredientId
  ) {
    throw new Error(
      'Pantry identity requires canonical Pack and/or Ingredient.',
    )
  }

  return [
    packId
      ? `pack:${packId}`
      : null,

    ingredientId
      ? `ingredient:${ingredientId}`
      : null,
  ]
    .filter(
      Boolean,
    )
    .join(
      '|',
    )
}

/*
|--------------------------------------------------------------------------
| Quantity
|--------------------------------------------------------------------------
*/

export function normalizePantryQuantity(
  quantity =
    null,
) {
  if (
    !quantity
  ) {
    return {
      mode:
        'unknown',

      value:
        null,

      min:
        null,

      max:
        null,

      unit:
        null,
    }
  }

  const mode =
    quantity.mode ||
    'unknown'

  if (
    mode ===
    'exact'
  ) {
    return {
      mode:
        'exact',

      value:
        Number(
          quantity.value,
        ),

      min:
        null,

      max:
        null,

      unit:
        quantity.unit ||
        null,
    }
  }

  if (
    mode ===
    'range'
  ) {
    return {
      mode:
        'range',

      value:
        null,

      min:
        Number(
          quantity.min,
        ),

      max:
        Number(
          quantity.max,
        ),

      unit:
        quantity.unit ||
        null,
    }
  }

  return {
    mode:
      'unknown',

    value:
      null,

    min:
      null,

    max:
      null,

    unit:
      null,
  }
}

/*
|--------------------------------------------------------------------------
| State-safe Quantity
|--------------------------------------------------------------------------
|
| Exact last-known quantity is not the same thing as exact current inventory.
|
| When state is inferred/uncertain we do not expose an exact number as current
| Pantry truth.
|
*/

export function sanitizeQuantityForPantryState(
  quantity,
  state,
) {
  const normalized =
    normalizePantryQuantity(
      quantity,
    )

  if (
    state ===
      'do_not_track'
  ) {
    return normalizePantryQuantity()
  }

  if (
    state ===
      'out'
  ) {
    return {
      mode:
        normalized.unit
          ? 'exact'
          : 'unknown',

      value:
        normalized.unit
          ? 0
          : null,

      min:
        null,

      max:
        null,

      unit:
        normalized.unit,
    }
  }

  if (
    state ===
      'inferred_available' ||
    state ===
      'uncertain'
  ) {
    if (
      normalized.mode ===
      'range'
    ) {
      return normalized
    }

    return {
      mode:
        'unknown',

      value:
        null,

      min:
        null,

      max:
        null,

      unit:
        normalized.unit,
    }
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Observation → State
|--------------------------------------------------------------------------
*/

export function derivePantryStateFromObservation({
  sourceType,
  currentState =
    'uncertain',
}) {
  switch (
    sourceType
  ) {
    case 'manual_have':
    case 'manual_quantity_correction':
    case 'marketplace_purchase':
    case 'external_purchase_confirmation':
    case 'barcode_capture':
    case 'product_photo':
    case 'shelf_photo':
    case 'receipt_import':
    case 'commerce_email_history':
    case 'resume_tracking':
      return 'confirmed_available'

    case 'running_low_confirmation':
      return 'running_low'

    case 'bought_elsewhere':
      return 'replenished_elsewhere'

    case 'finished':
    case 'discard_expiry':
      return 'out'

    case 'do_not_track':
      return 'do_not_track'

    case 'inference':
      return 'inferred_available'

    case 'recipe_consumption':
    case 'opened':
    case 'storage_update':
    case 'planned_use':
    case 'use_soon':
      return currentState

    default:
      return currentState
  }
}

/*
|--------------------------------------------------------------------------
| Confidence
|--------------------------------------------------------------------------
*/

export function deriveObservationConfidence(
  sourceType,
  {
    customerCorrection =
      false,
  } = {},
) {
  if (
    customerCorrection
  ) {
    return 1
  }

  return roundConfidence(
    getPantryBaseConfidence(
      sourceType,
    ),
  )
}

export function deriveObservationEvidenceStrength(
  sourceType,
  {
    customerCorrection =
      false,
  } = {},
) {
  if (
    customerCorrection
  ) {
    return 100
  }

  return getPantryEvidenceStrength(
    sourceType,
  )
}

/*
|--------------------------------------------------------------------------
| Confidence Decay
|--------------------------------------------------------------------------
|
| Exponential half-life:
|
| confidence(t) = base * 0.5 ^ (elapsedDays / halfLifeDays)
|
| Deterministic and reproducible.
|
*/

export function calculateDecayedPantryConfidence({
  baseConfidence,
  observedAt,
  now =
    new Date(),
  halfLifeDays,
}) {
  const base =
    clamp01(
      baseConfidence,
    )

  const observed =
    asDate(
      observedAt,
    )

  const current =
    asDate(
      now,
    )

  if (
    current.getTime() <=
    observed.getTime()
  ) {
    return roundConfidence(
      base,
    )
  }

  const halfLife =
    Number(
      halfLifeDays,
    )

  if (
    !Number.isFinite(
      halfLife,
    ) ||
    halfLife <=
      0
  ) {
    return roundConfidence(
      base,
    )
  }

  const elapsedMilliseconds =
    current.getTime() -
    observed.getTime()

  const elapsedDays =
    elapsedMilliseconds /
    (
      24 *
      60 *
      60 *
      1000
    )

  const multiplier =
    Math.pow(
      0.5,
      elapsedDays /
        halfLife,
    )

  return roundConfidence(
    base *
      multiplier,
  )
}

/*
|--------------------------------------------------------------------------
| Projection Ordering
|--------------------------------------------------------------------------
|
| History can contain out-of-order ingestion.
|
| A stale observation is preserved in history but does not rewrite newer
| current state.
|
| At the same timestamp, stronger evidence wins.
|
*/

export function shouldApplyPantryObservation({
  currentItem =
    null,

  observation,
}) {
  if (
    !currentItem ||
    !currentItem.lastObservationAt
  ) {
    return {
      apply:
        true,

      reason:
        'first_observation',
    }
  }

  const currentAt =
    asDate(
      currentItem.lastObservationAt,
    )

  const nextAt =
    asDate(
      observation.observedAt,
    )

  if (
    nextAt.getTime() >
    currentAt.getTime()
  ) {
    return {
      apply:
        true,

      reason:
        'newer_observation',
    }
  }

  if (
    nextAt.getTime() <
    currentAt.getTime()
  ) {
    return {
      apply:
        false,

      reason:
        'stale_observation_preserved_in_history',
    }
  }

  const currentStrength =
    Number(
      currentItem.evidenceStrength ||
      0,
    )

  const nextStrength =
    Number(
      observation.evidenceStrength ||
      0,
    )

  if (
    nextStrength >=
    currentStrength
  ) {
    return {
      apply:
        true,

      reason:
        'same_time_stronger_or_equal_evidence',
    }
  }

  return {
    apply:
      false,

    reason:
      'same_time_weaker_evidence_preserved_in_history',
  }
}

/*
|--------------------------------------------------------------------------
| Build Deterministic Observation
|--------------------------------------------------------------------------
*/

export function buildPantryObservationProjection({
  input,
  currentItem =
    null,
  observedAt =
    new Date(),
}) {
  const sourceType =
    input.sourceType

  const customerCorrection =
    sourceType ===
      'manual_quantity_correction'

  const state =
    derivePantryStateFromObservation({
      sourceType,

      currentState:
        currentItem?.state ||
        'uncertain',
    })

  const confidence =
    deriveObservationConfidence(
      sourceType,
      {
        customerCorrection,
      },
    )

  const evidenceStrength =
    deriveObservationEvidenceStrength(
      sourceType,
      {
        customerCorrection,
      },
    )

  let quantity =
    normalizePantryQuantity(
      input.quantity ||
      currentItem
        ?.quantityEstimate,
    )

  if (
    sourceType ===
      'finished' ||
    sourceType ===
      'discard_expiry'
  ) {
    quantity = {
      mode:
        quantity.unit
          ? 'exact'
          : 'unknown',

      value:
        quantity.unit
          ? 0
          : null,

      min:
        null,

      max:
        null,

      unit:
        quantity.unit,
    }
  }

  if (
    sourceType ===
    'do_not_track'
  ) {
    quantity =
      normalizePantryQuantity()
  }

  return {
    sourceType,

    stateSignal:
      state,

    quantitySignal:
      quantity,

    confidenceWeight:
      confidence,

    evidenceStrength,

    customerCorrection,

    observedAt:
      asDate(
        observedAt,
      ),

    storageZoneSignal:
      input.storageZone ||
      null,

    openedAtSignal:
      input.openedAt
        ? asDate(
            input.openedAt,
          )
        : null,

    useSoonAtSignal:
      input.useSoonAt
        ? asDate(
            input.useSoonAt,
          )
        : null,

    plannedUseAtSignal:
      input.plannedUseAt
        ? asDate(
            input.plannedUseAt,
          )
        : null,

    note:
      input.note ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Apply Observation to Current Projection
|--------------------------------------------------------------------------
*/

export function projectPantryItemFromObservation({
  currentItem =
    null,

  observation,
  actorUserId =
    null,
}) {
  const decision =
    shouldApplyPantryObservation({
      currentItem,

      observation,
    })

  if (
    !decision.apply
  ) {
    return {
      applied:
        false,

      reason:
        decision.reason,

      item:
        currentItem,
    }
  }

  const state =
    observation.stateSignal

  const quantityEstimate =
    sanitizeQuantityForPantryState(
      observation.quantitySignal,
      state,
    )

  const next = {
    ...(currentItem ||
      {}),

    state,

    quantityEstimate,

    confidence:
      observation.confidenceWeight,

    evidenceStrength:
      observation.evidenceStrength,

    lastSourceType:
      observation.sourceType,

    lastObservationAt:
      observation.observedAt,

    updatedByUserId:
      actorUserId ||
      currentItem
        ?.updatedByUserId ||
      null,
  }

  if (
    observation.storageZoneSignal
  ) {
    next.storageZone =
      observation.storageZoneSignal
  }

  if (
    observation.openedAtSignal !==
    null
  ) {
    next.openedAt =
      observation.openedAtSignal
  }

  if (
    observation.useSoonAtSignal !==
    null
  ) {
    next.useSoonAt =
      observation.useSoonAtSignal
  }

  if (
    observation.plannedUseAtSignal !==
    null
  ) {
    next.plannedUseAt =
      observation.plannedUseAtSignal
  }

  if (
    state ===
    'do_not_track'
  ) {
    next.trackingPausedAt =
      observation.observedAt
  }

  if (
    observation.sourceType ===
    'resume_tracking'
  ) {
    next.trackingPausedAt =
      null
  }

  return {
    applied:
      true,

    reason:
      decision.reason,

    item:
      next,
  }
}

/*
|--------------------------------------------------------------------------
| Read-time Current State
|--------------------------------------------------------------------------
|
| Confidence decay is calculated at read time.
|
| No fake background inventory mutation is needed.
|
*/

export function projectPantryItemAtTime(
  item,
  now =
    new Date(),
) {
  if (
    !item
  ) {
    return null
  }

  const state =
    item.state

  if (
    PANTRY_TERMINAL_NON_DECAY_STATES.includes(
      state,
    ) ||
    !item.lastObservationAt
  ) {
    return {
      ...item,

      quantityEstimate:
        sanitizeQuantityForPantryState(
          item.quantityEstimate,
          state,
        ),
    }
  }

  const halfLifeDays =
    getPantryConfidenceHalfLifeDays(
      item.lastSourceType,
    )

  const confidence =
    calculateDecayedPantryConfidence({
      baseConfidence:
        item.confidence,

      observedAt:
        item.lastObservationAt,

      now,

      halfLifeDays,
    })

  let projectedState =
    state

  if (
    confidence <
      PANTRY_UNCERTAIN_CONFIDENCE_THRESHOLD &&
    [
      'confirmed_available',
      'inferred_available',
      'running_low',
      'replenished_elsewhere',
    ].includes(
      state,
    )
  ) {
    projectedState =
      'uncertain'
  }

  return {
    ...item,

    state:
      projectedState,

    confidence,

    quantityEstimate:
      sanitizeQuantityForPantryState(
        item.quantityEstimate,
        projectedState,
      ),
  }
}