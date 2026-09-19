/*
|--------------------------------------------------------------------------
| M08 — Food Intelligence Constants
|--------------------------------------------------------------------------
|
| Authoritative safety rules:
|
| - Deterministic/versioned logic is authoritative.
| - Unknown allergen evidence fails closed.
| - Unknown must never become "free from".
| - contains remains distinct from may-contain / cross-contact.
| - Every calculation retains source/rule/version lineage.
|
*/

export const FOOD_EVIDENCE_STATES =
  Object.freeze([
    'verified_source',
    'operator_declared',
    'calculated',
    'inferred',
    'unknown_review_required',
  ])

export const ALLERGEN_RELATION_TYPES =
  Object.freeze([
    'contains',
    'may_contain',
    'cross_contact',
  ])

export const INGREDIENT_RELATION_STATUSES =
  Object.freeze([
    'draft',
    'active',
    'retired',
  ])

export const FOOD_RULE_TYPES =
  Object.freeze([
    'nutrition',
    'allergen',
    'dietary',
  ])

export const FOOD_RULE_STATUSES =
  Object.freeze([
    'draft',
    'active',
    'retired',
  ])

export const FOOD_CALCULATION_ENTITY_TYPES =
  Object.freeze([
    'product_version',
    'recipe_version',
  ])

export const FOOD_CALCULATION_STATUSES =
  Object.freeze([
    'calculated',
    'requires_review',
    'approved',
    'superseded',
    'disabled',
  ])

export const ALLERGEN_CALCULATION_OUTCOMES =
  Object.freeze([
    'contains',
    'may_contain',
    'cross_contact',
    'not_detected_verified',
    'unknown_review_required',
  ])

export const DIETARY_CALCULATION_OUTCOMES =
  Object.freeze([
    'eligible',
    'not_eligible',
    'unknown_review_required',
  ])

export const FOOD_INTELLIGENCE_COLLECTIONS =
  Object.freeze({
    ALLERGEN:
      'allergens',

    NUTRIENT:
      'nutrients',

    INGREDIENT_RELATION:
      'ingredientRelations',

    RULE_PROFILE:
      'ruleProfiles',

    FOOD_CALCULATION:
      'foodCalculations',
  })

export function normalizeFoodKey(
  value,
) {
  return String(
    value ||
      '',
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '_',
    )
    .replace(
      /^_+|_+$/g,
      '',
    )
}

export function normalizeJurisdictionCode(
  value,
) {
  return String(
    value ||
      '',
  )
    .trim()
    .toUpperCase()
}