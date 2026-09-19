import crypto from 'node:crypto'

import {
  ALLERGEN_RELATION_TYPES,
  FOOD_EVIDENCE_STATES,
} from './foodIntelligence.constants.js'

const ALLERGEN_OUTCOME_PRIORITY =
  Object.freeze({
    cross_contact:
      1,

    may_contain:
      2,

    contains:
      3,
  })

function ensureFiniteNonNegativeNumber(
  value,
  label,
) {
  const numeric =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      numeric,
    ) ||
    numeric <
      0
  ) {
    throw new TypeError(
      `${label} must be a finite non-negative number.`,
    )
  }

  return numeric
}

function normalizeEvidenceState(
  value,
) {
  return FOOD_EVIDENCE_STATES.includes(
    value,
  )
    ? value
    : 'unknown_review_required'
}

function canonicalizeValue(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return value
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      canonicalizeValue,
    )
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString()
  }

  if (
    typeof value ===
      'object'
  ) {
    return Object.keys(
      value,
    )
      .sort()
      .reduce(
        (
          result,
          key,
        ) => {
          result[
            key
          ] =
            canonicalizeValue(
              value[
                key
              ],
            )

          return result
        },
        {},
      )
  }

  return value
}

/*
|--------------------------------------------------------------------------
| Evidence Derivation
|--------------------------------------------------------------------------
|
| A deterministic result can be "calculated" only when the source chain is
| complete enough to support that calculation.
|
| Unknown remains unknown.
| Inferred safety input remains inferred.
|--------------------------------------------------------------------------
*/

export function deriveCalculatedEvidenceState({
  evidenceComplete,
  sourceEvidenceStates =
    [],
}) {
  if (
    evidenceComplete !==
    true
  ) {
    return 'unknown_review_required'
  }

  const normalized =
    sourceEvidenceStates.map(
      normalizeEvidenceState,
    )

  if (
    normalized.includes(
      'unknown_review_required',
    )
  ) {
    return 'unknown_review_required'
  }

  if (
    normalized.includes(
      'inferred',
    )
  ) {
    return 'inferred'
  }

  return 'calculated'
}

/*
|--------------------------------------------------------------------------
| Allergen Propagation
|--------------------------------------------------------------------------
|
| Rules:
|
| contains > may_contain > cross_contact
|
| These states are NEVER collapsed into one generic boolean.
|
| Incomplete evidence fails closed.
|--------------------------------------------------------------------------
*/

export function evaluateAllergenPropagation({
  relationships =
    [],

  evidenceComplete =
    false,
}) {
  const byAllergen =
    new Map()

  const sourceEvidenceStates =
    []

  for (
    const relationship of
    relationships
  ) {
    const allergenId =
      String(
        relationship?.allergenId ||
        '',
      ).trim()

    if (!allergenId) {
      throw new TypeError(
        'Allergen relationship requires allergenId.',
      )
    }

    const relationType =
      relationship?.relationType

    if (
      !ALLERGEN_RELATION_TYPES.includes(
        relationType,
      )
    ) {
      throw new TypeError(
        `Unsupported allergen relationship type: ${relationType}`,
      )
    }

    const evidenceState =
      normalizeEvidenceState(
        relationship?.evidenceState,
      )

    sourceEvidenceStates.push(
      evidenceState,
    )

    const existing =
      byAllergen.get(
        allergenId,
      )

    if (
      !existing ||
      ALLERGEN_OUTCOME_PRIORITY[
        relationType
      ] >
        ALLERGEN_OUTCOME_PRIORITY[
          existing.outcome
        ]
    ) {
      byAllergen.set(
        allergenId,
        {
          allergenId,

          outcome:
            relationType,

          evidenceState,

          ingredientRelationIds:
            relationship
              ?.ingredientRelationId
              ? [
                  String(
                    relationship
                      .ingredientRelationId,
                  ),
                ]
              : [],
        },
      )

      continue
    }

    if (
      relationship
        ?.ingredientRelationId
    ) {
      existing
        .ingredientRelationIds
        .push(
          String(
            relationship
              .ingredientRelationId,
          ),
        )
    }

    if (
      evidenceState ===
      'unknown_review_required'
    ) {
      existing.evidenceState =
        'unknown_review_required'
    } else if (
      evidenceState ===
        'inferred' &&
      existing.evidenceState !==
        'unknown_review_required'
    ) {
      existing.evidenceState =
        'inferred'
    }
  }

  const allergens =
    [
      ...byAllergen.values(),
    ].sort(
      (
        left,
        right,
      ) =>
        left.allergenId.localeCompare(
          right.allergenId,
        ),
    )

  const calculationEvidenceState =
    deriveCalculatedEvidenceState({
      evidenceComplete,

      sourceEvidenceStates,
    })

  /*
  |--------------------------------------------------------------------------
  | Free-from Safety Boundary
  |--------------------------------------------------------------------------
  |
  | This boolean does NOT create a marketing/legal "free from" claim.
  |
  | It only says the supplied deterministic dataset is complete enough and
  | contains no known relationship for this calculation scope.
  |
  | A governed consumer claim still requires its own policy/evidence review.
  |--------------------------------------------------------------------------
  */

  const freeFromVerificationAllowed =
    evidenceComplete ===
      true &&
    calculationEvidenceState !==
      'unknown_review_required' &&
    calculationEvidenceState !==
      'inferred' &&
    allergens.length ===
      0

  return {
    allergens,

    evidenceComplete:
      evidenceComplete ===
      true,

    evidenceState:
      calculationEvidenceState,

    requiresVerification:
      calculationEvidenceState ===
        'unknown_review_required' ||
      calculationEvidenceState ===
        'inferred',

    freeFromVerificationAllowed,
  }
}

/*
|--------------------------------------------------------------------------
| Nutrient Aggregation
|--------------------------------------------------------------------------
|
| This function expects inputs already normalized into each Nutrient's
| canonical unit.
|
| Example:
|
| protein -> g
| sodium  -> mg
|
| Pack conversion does NOT belong here.
|--------------------------------------------------------------------------
*/

export function aggregateNormalizedNutrients({
  components =
    [],

  evidenceComplete =
    false,

  basis =
    'calculation_scope',
}) {
  const nutrientMap =
    new Map()

  const sourceEvidenceStates =
    []

  for (
    const component of
    components
  ) {
    const quantityFactor =
      ensureFiniteNonNegativeNumber(
        component
          ?.quantityFactor ??
          1,

        'Nutrient component quantityFactor',
      )

    const componentEvidenceState =
      normalizeEvidenceState(
        component
          ?.evidenceState,
      )

    sourceEvidenceStates.push(
      componentEvidenceState,
    )

    for (
      const nutrient of
      component?.nutrients ||
      []
    ) {
      const nutrientId =
        String(
          nutrient?.nutrientId ||
          '',
        ).trim()

      const unit =
        String(
          nutrient?.unit ||
          '',
        ).trim()

      if (!nutrientId) {
        throw new TypeError(
          'Nutrient row requires nutrientId.',
        )
      }

      if (!unit) {
        throw new TypeError(
          `Nutrient ${nutrientId} requires a canonical unit.`,
        )
      }

      const amount =
        ensureFiniteNonNegativeNumber(
          nutrient?.amount,

          `Nutrient ${nutrientId} amount`,
        )

      const existing =
        nutrientMap.get(
          nutrientId,
        )

      if (
        existing &&
        existing.unit !==
          unit
      ) {
        throw new TypeError(
          `Nutrient ${nutrientId} uses incompatible canonical units: ${existing.unit} and ${unit}.`,
        )
      }

      if (!existing) {
        nutrientMap.set(
          nutrientId,
          {
            nutrientId,

            amount:
              amount *
              quantityFactor,

            unit,

            basis,
          },
        )

        continue
      }

      existing.amount +=
        amount *
        quantityFactor
    }
  }

  const evidenceState =
    deriveCalculatedEvidenceState({
      evidenceComplete,

      sourceEvidenceStates,
    })

  return {
    nutrients:
      [
        ...nutrientMap.values(),
      ]
        .map(
          (
            nutrient,
          ) => ({
            ...nutrient,

            amount:
              Number(
                nutrient
                  .amount
                  .toFixed(
                    8,
                  ),
              ),

            evidenceState,
          }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.nutrientId.localeCompare(
              right.nutrientId,
            ),
        ),

    evidenceState,

    requiresVerification:
      evidenceState ===
        'unknown_review_required' ||
      evidenceState ===
        'inferred',
  }
}

/*
|--------------------------------------------------------------------------
| Explicit Dietary Rule Evaluation
|--------------------------------------------------------------------------
|
| M08 does not guess what "vegetarian", "vegan", etc. mean.
|
| The caller must provide a governed RuleProfile compiled into explicit
| required facts.
|
| Example:
|
| requiredFacts:
| [
|   { factKey: 'contains_meat', expectedValue: false },
|   { factKey: 'contains_fish', expectedValue: false }
| ]
|
| Missing fact => unknown_review_required.
|--------------------------------------------------------------------------
*/

export function evaluateExplicitDietaryRule({
  ruleKey,

  requiredFacts =
    [],

  factMap =
    {},

  evidenceComplete =
    false,
}) {
  const normalizedRuleKey =
    String(
      ruleKey ||
      '',
    ).trim()

  if (!normalizedRuleKey) {
    throw new TypeError(
      'Dietary rule requires ruleKey.',
    )
  }

  if (
    evidenceComplete !==
    true
  ) {
    return {
      ruleKey:
        normalizedRuleKey,

      outcome:
        'unknown_review_required',

      evidenceState:
        'unknown_review_required',

      reasonCodes: [
        'FOOD_EVIDENCE_INCOMPLETE',
      ],
    }
  }

  for (
    const requirement of
    requiredFacts
  ) {
    const factKey =
      String(
        requirement
          ?.factKey ||
        '',
      ).trim()

    if (!factKey) {
      throw new TypeError(
        'Dietary rule requirement requires factKey.',
      )
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        factMap,
        factKey,
      )
    ) {
      return {
        ruleKey:
          normalizedRuleKey,

        outcome:
          'unknown_review_required',

        evidenceState:
          'unknown_review_required',

        reasonCodes: [
          'FOOD_DIETARY_FACT_UNKNOWN',
          factKey,
        ],
      }
    }

    if (
      factMap[
        factKey
      ] !==
      requirement.expectedValue
    ) {
      return {
        ruleKey:
          normalizedRuleKey,

        outcome:
          'not_eligible',

        evidenceState:
          'calculated',

        reasonCodes: [
          'FOOD_DIETARY_RULE_NOT_SATISFIED',
          factKey,
        ],
      }
    }
  }

  return {
    ruleKey:
      normalizedRuleKey,

    outcome:
      'eligible',

    evidenceState:
      'calculated',

    reasonCodes: [
      'FOOD_DIETARY_RULE_SATISFIED',
    ],
  }
}

/*
|--------------------------------------------------------------------------
| Reproducibility Fingerprint
|--------------------------------------------------------------------------
|
| Same inputs + same source versions + same rule versions + same assumptions
| must produce the same fingerprint.
|--------------------------------------------------------------------------
*/

export function buildFoodCalculationFingerprint(
  input,
) {
  const canonical =
    canonicalizeValue(
      input,
    )

  return crypto
    .createHash(
      'sha256',
    )
    .update(
      JSON.stringify(
        canonical,
      ),
    )
    .digest(
      'hex',
    )
}

/*
|--------------------------------------------------------------------------
| Calculation Snapshot Builder
|--------------------------------------------------------------------------
*/

export function buildFoodCalculationSnapshot({
  entityType,
  entityId,
  calculationVersion,
  engineVersion,
  sourceVersions =
    [],
  ruleProfileVersions =
    [],
  inputs =
    [],
  assumptions =
    [],
  yieldFactors =
    [],
  nutrients =
    [],
  allergens =
    [],
  dietary =
    [],
  evidenceState,
  basis,
}) {
  const fingerprintInput = {
    entityType,

    entityId:
      String(
        entityId,
      ),

    calculationVersion,

    engineVersion,

    sourceVersions,

    ruleProfileVersions,

    inputs,

    assumptions,

    yieldFactors,

    nutrients,

    allergens,

    dietary,

    evidenceState,

    basis,
  }

  return {
    ...fingerprintInput,

    fingerprint:
      buildFoodCalculationFingerprint(
        fingerprintInput,
      ),
  }
}