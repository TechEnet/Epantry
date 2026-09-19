export const DISH_STATUSES =
  Object.freeze([
    'active',
    'disabled',
    'retired',
  ])

export const RECIPE_VERSION_STATUSES =
  Object.freeze([
    'draft',
    'in_review',
    'published',
    'retired',
    'disabled',
  ])

export const RECIPE_SOURCE_TYPES =
  Object.freeze([
    'internal',
    'brand',
    'chef',
    'community',
    'imported',
  ])

export const RECIPE_DIFFICULTIES =
  Object.freeze([
    'easy',
    'medium',
    'hard',
  ])

export const RECIPE_SCALING_METHODS =
  Object.freeze([
    'linear',
    'mixed',
  ])

export const RECIPE_INGREDIENT_ROLES =
  Object.freeze([
    'main',
    'base',
    'seasoning',
    'garnish',
    'liquid',
    'fat',
    'binder',
    'leavening',
    'sauce',
    'other',
  ])

export const RECIPE_INGREDIENT_SCALING_RULE_TYPES =
  Object.freeze([
    'linear',
    'fixed',
    'power',
    'bounded',
  ])

export const RECIPE_REVIEW_TYPES =
  Object.freeze([
    'editorial',
    'qa',
    'safety',
  ])

export const RECIPE_REVIEW_DECISIONS =
  Object.freeze([
    'submitted',
    'approved',
    'changes_requested',
    'rejected',
    'disabled',
    'retired',
  ])

export const RECIPE_UNIT_DIMENSIONS =
  Object.freeze({
    mass:
      Object.freeze([
        'mg',
        'g',
        'kg',
      ]),

    volume:
      Object.freeze([
        'ml',
        'l',
        'tsp',
        'tbsp',
        'cup',
      ]),

    count:
      Object.freeze([
        'piece',
        'slice',
        'clove',
        'bunch',
      ]),

    culinary:
      Object.freeze([
        'pinch',
      ]),
  })

export const RECIPE_UNITS =
  Object.freeze(
    Object.values(
      RECIPE_UNIT_DIMENSIONS,
    ).flat(),
  )

const RECIPE_UNIT_SET =
  new Set(
    RECIPE_UNITS,
  )

export function normalizeRecipeKey(
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

export function normalizeRecipeSlug(
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
      '-',
    )
    .replace(
      /^-+|-+$/g,
      '',
    )
}

export function normalizeRecipeUnit(
  value,
) {
  const normalized =
    String(
      value ||
        '',
    )
      .trim()
      .toLowerCase()

  return RECIPE_UNIT_SET.has(
    normalized,
  )
    ? normalized
    : null
}

export function getRecipeUnitDimension(
  unit,
) {
  const normalized =
    normalizeRecipeUnit(
      unit,
    )

  if (!normalized) {
    return null
  }

  for (
    const [
      dimension,
      units,
    ]
    of Object.entries(
      RECIPE_UNIT_DIMENSIONS,
    )
  ) {
    if (
      units.includes(
        normalized,
      )
    ) {
      return dimension
    }
  }

  return null
}