import {
  createHash,
  randomBytes,
} from 'node:crypto'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  CanonicalIngredient,
} from '../catalog/catalog.models.js'

import {
  listPublicBrands,
  listPublicProducts,
} from '../catalog/catalog.public.service.js'

import {
  getPublicProductFoodIntelligence,
  getPublicRecipeFoodIntelligence,
} from '../foodIntelligence/foodIntelligence.public.service.js'

import {
  getCurrentHouseholdContext,
} from '../households/household.service.js'

import {
  listPantryItems,
} from '../pantry/pantry.service.js'

import {
  getWhatShouldWeCook,
  listPublicRecipes,
} from '../recipes/recipe.public.service.js'

import {
  explainReasonCodes,
  getRecipeTotalTimeMinutes,
  mergeSearchIntent,
  normalizeSearchText,
  parseDeterministicSearchIntent,
  scoreRecipeSearchCandidate,
  scoreSimpleSearchCandidate,
  sortSearchCandidates,
} from './search.engine.js'

import {
  CandidateSet,
  RankingDecision,
  SearchEvent,
  SearchSession,
} from './search.models.js'

const SEARCH_RESULT_LIMIT =
  30

const PER_SOURCE_LIMIT =
  18

const CONFIRMED_PANTRY_STATES =
  new Set([
    'confirmed_available',
    'replenished_elsewhere',
  ])

const ALLERGEN_FREE_RULE_KEYS =
  Object.freeze({
    peanut: [
      'peanut_free',
      'peanuts_free',
      'nut_free',
      'nuts_free',
    ],

    nuts: [
      'nut_free',
      'nuts_free',
    ],

    milk: [
      'milk_free',
      'dairy_free',
    ],

    egg: [
      'egg_free',
      'eggs_free',
    ],

    soy: [
      'soy_free',
      'soya_free',
    ],

    gluten: [
      'gluten_free',
    ],

    wheat: [
      'wheat_free',
      'gluten_free',
    ],
  })

function stringifyId(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  return String(
    value,
  )
}

function sameIdentifier(
  left,
  right,
) {
  const normalizedLeft =
    stringifyId(
      left,
    )

  const normalizedRight =
    stringifyId(
      right,
    )

  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    normalizedLeft ===
      normalizedRight,
  )
}

function escapeRegex(
  value,
) {
  return String(
    value ||
      '',
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}

function normalizeRuleKey(
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

function createContinuationToken() {
  return randomBytes(
    32,
  ).toString(
    'base64url',
  )
}

function hashContinuationToken(
  token,
) {
  return createHash(
    'sha256',
  )
    .update(
      String(
        token ||
          '',
      ),
      'utf8',
    )
    .digest(
      'hex',
    )
}

function serializeConstraints(
  constraints,
) {
  const value =
    typeof constraints?.toObject ===
      'function'
      ? constraints.toObject()
      : constraints ||
        {}

  return {
    maxTimeMinutes:
      value.maxTimeMinutes ??
      null,

    servings:
      value.servings ??
      null,

    budgetMinor:
      value.budgetMinor ??
      null,

    currency:
      value.currency ||
      'INR',

    course:
      value.course ||
      null,

    cuisine:
      value.cuisine ||
      null,

    dietaryKeys:
      Array.isArray(
        value.dietaryKeys,
      )
        ? value.dietaryKeys
        : [],

    excludedAllergens:
      Array.isArray(
        value.excludedAllergens,
      )
        ? value.excludedAllergens
        : [],

    usePantry:
      value.usePantry ===
      true,

    commerceObjective:
      value.commerceObjective ||
      null,

    preferenceSignals:
      Array.isArray(
        value.preferenceSignals,
      )
        ? value.preferenceSignals
        : [],
  }
}

function getActorType(
  actorContext,
) {
  if (
    actorContext?.actorType ===
    'customer'
  ) {
    return 'customer'
  }

  if (
    actorContext?.actorType ===
    'authenticated_non_customer'
  ) {
    return 'authenticated_non_customer'
  }

  return 'guest'
}

function getOwnerUserId(
  actorContext,
) {
  return getActorType(
    actorContext,
  ) ===
    'customer'
    ? actorContext?.currentUser?._id ||
      null
    : null
}

async function resolveHouseholdForSearch({
  actorContext,
  usePantry,
}) {
  if (
    !usePantry ||
    getActorType(
      actorContext,
    ) !==
      'customer' ||
    !actorContext?.currentUser
  ) {
    return null
  }

  const context =
    await getCurrentHouseholdContext(
      actorContext.currentUser._id,
    )

  return context?.hasHousehold
    ? context.household
    : null
}

async function loadCustomerPantryContext({
  actorContext,
  usePantry,
}) {
  if (
    !usePantry
  ) {
    return {
      enabled:
        false,

      householdId:
        null,

      confirmedIngredientIds:
        [],

      uncertainIngredientIds:
        [],
    }
  }

  if (
    getActorType(
      actorContext,
    ) !==
      'customer' ||
    !actorContext?.currentUser
  ) {
    return {
      enabled:
        false,

      householdId:
        null,

      confirmedIngredientIds:
        [],

      uncertainIngredientIds:
        [],

      requiresCustomer:
        true,
    }
  }

  const household =
    await resolveHouseholdForSearch({
      actorContext,

      usePantry:
        true,
    })

  if (
    !household?.id
  ) {
    return {
      enabled:
        false,

      householdId:
        null,

      confirmedIngredientIds:
        [],

      uncertainIngredientIds:
        [],

      noHousehold:
        true,
    }
  }

  const pantry =
    await listPantryItems(
      {
        page:
          1,

        limit:
          100,
      },
      actorContext.currentUser,
    )

  const confirmed = []
  const uncertain = []

  for (
    const item
    of pantry?.items ||
    []
  ) {
    if (
      !item?.canonicalIngredientId ||
      item.trackingPaused ===
        true ||
      item.state ===
        'out' ||
      item.state ===
        'do_not_track'
    ) {
      continue
    }

    if (
      CONFIRMED_PANTRY_STATES.has(
        item.state,
      )
    ) {
      confirmed.push(
        item.canonicalIngredientId,
      )
    } else {
      uncertain.push(
        item.canonicalIngredientId,
      )
    }
  }

  return {
    enabled:
      true,

    householdId:
      household.id,

    confirmedIngredientIds: [
      ...new Set(
        confirmed,
      ),
    ],

    uncertainIngredientIds: [
      ...new Set(
        uncertain,
      ),
    ],
  }
}

async function resolveCanonicalIngredients(
  terms,
) {
  const normalizedTerms =
    [
      ...new Set(
        (terms || [])
          .map(
            (
              term,
            ) =>
              normalizeSearchText(
                term,
              ).toLowerCase(),
          )
          .filter(
            (
              term,
            ) =>
              term.length >=
              2,
          ),
      ),
    ].slice(
      0,
      10,
    )

  if (
    normalizedTerms.length ===
    0
  ) {
    return []
  }

  const expressions =
    normalizedTerms.map(
      (
        term,
      ) =>
        new RegExp(
          `(^|\\s)${escapeRegex(
            term,
          )}(\\s|$)`,
          'i',
        ),
    )

  const rows =
    await CanonicalIngredient.find({
      status:
        'active',

      $or: [
        {
          canonicalName: {
            $in:
              expressions,
          },
        },

        {
          aliases: {
            $in:
              expressions,
          },
        },
      ],
    })
      .sort({
        canonicalName:
          1,

        _id:
          1,
      })
      .limit(
        24,
      )
      .select({
        canonicalName:
          1,

        slug:
          1,

        aliases:
          1,
      })
      .lean()

  return rows.map(
    (
      row,
    ) => ({
      id:
        stringifyId(
          row._id,
        ),

      name:
        row.canonicalName,

      slug:
        row.slug,

      aliases:
        Array.isArray(
          row.aliases,
        )
          ? row.aliases
          : [],
    }),
  )
}

function dietaryRuleIsEligible(
  intelligence,
  ruleKeys,
) {
  const normalizedKeys =
    new Set(
      (ruleKeys || []).map(
        normalizeRuleKey,
      ),
    )

  return (
    intelligence?.dietary ||
    []
  ).some(
    (
      rule,
    ) => {
      const keys = [
        normalizeRuleKey(
          rule?.key,
        ),
        normalizeRuleKey(
          rule?.name,
        ),
      ]

      const matches =
        keys.some(
          (
            key,
          ) =>
            key &&
            normalizedKeys.has(
              key,
            ),
        )

      if (
        !matches
      ) {
        return false
      }

      return (
        rule?.eligible ===
          true ||
        normalizeRuleKey(
          rule?.status,
        ) ===
          'eligible'
      )
    },
  )
}

function allergenRelationshipBlocks(
  intelligence,
  allergenKey,
) {
  const normalizedTarget =
    normalizeRuleKey(
      allergenKey,
    )

  return (
    intelligence?.allergens ||
    []
  ).some(
    (
      allergen,
    ) => {
      const identityKeys = [
        normalizeRuleKey(
          allergen?.key,
        ),
        normalizeRuleKey(
          allergen?.name,
        ),
      ]

      const identityMatches =
        identityKeys.some(
          (
            key,
          ) =>
            key &&
            (
              key ===
                normalizedTarget ||
              key.includes(
                normalizedTarget,
              ) ||
              normalizedTarget.includes(
                key,
              )
            ),
        )

      if (
        !identityMatches
      ) {
        return false
      }

      const relationship =
        normalizeRuleKey(
          allergen?.relationship,
        )

      return [
        'contains',
        'may_contain',
        'present',
        'cross_contact',
      ].includes(
        relationship,
      )
    },
  )
}

async function evaluateHardFoodConstraints({
  candidateType,
  subjectId,
  constraints,
}) {
  const dietaryKeys =
    constraints.dietaryKeys ||
    []

  const excludedAllergens =
    constraints.excludedAllergens ||
    []

  if (
    dietaryKeys.length ===
      0 &&
    excludedAllergens.length ===
      0
  ) {
    return {
      allowed:
        true,

      reasonCodes:
        [],
    }
  }

  if (
    ![
      'recipe',
      'product',
    ].includes(
      candidateType,
    )
  ) {
    return {
      allowed:
        false,

      reasonCodes:
        [],

      blockedCode:
        'FOOD_CONSTRAINT_NOT_APPLICABLE_TO_RESULT_TYPE',
    }
  }

  let intelligence

  try {
    intelligence =
      candidateType ===
      'recipe'
        ? await getPublicRecipeFoodIntelligence(
            subjectId,
          )
        : await getPublicProductFoodIntelligence(
            subjectId,
          )
  } catch {
    return {
      allowed:
        false,

      reasonCodes:
        [],

      blockedCode:
        'FOOD_SAFETY_EVIDENCE_UNAVAILABLE',
    }
  }

  if (
    !intelligence?.available ||
    intelligence.verificationStatus ===
      'cannot_verify'
  ) {
    return {
      allowed:
        false,

      reasonCodes:
        [],

      blockedCode:
        'FOOD_SAFETY_EVIDENCE_UNAVAILABLE',
    }
  }

  const reasonCodes = []

  for (
    const dietaryKey
    of dietaryKeys
  ) {
    if (
      !dietaryRuleIsEligible(
        intelligence,
        [
          dietaryKey,
        ],
      )
    ) {
      return {
        allowed:
          false,

        reasonCodes:
          [],

        blockedCode:
          'DIETARY_CONSTRAINT_NOT_VERIFIED',
      }
    }
  }

  if (
    dietaryKeys.length >
    0
  ) {
    reasonCodes.push(
      'DIETARY_CONSTRAINT_VERIFIED',
    )
  }

  for (
    const allergenKey
    of excludedAllergens
  ) {
    if (
      allergenRelationshipBlocks(
        intelligence,
        allergenKey,
      )
    ) {
      return {
        allowed:
          false,

        reasonCodes:
          [],

        blockedCode:
          'ALLERGEN_CONSTRAINT_VIOLATED',
      }
    }

    const freeRuleKeys =
      ALLERGEN_FREE_RULE_KEYS[
        allergenKey
      ] ||
      [
        `${allergenKey}_free`,
      ]

    if (
      !dietaryRuleIsEligible(
        intelligence,
        freeRuleKeys,
      )
    ) {
      return {
        allowed:
          false,

        reasonCodes:
          [],

        blockedCode:
          'ALLERGEN_FREE_STATUS_NOT_VERIFIED',
      }
    }
  }

  if (
    excludedAllergens.length >
    0
  ) {
    reasonCodes.push(
      'ALLERGEN_CONSTRAINT_VERIFIED',
    )
  }

  return {
    allowed:
      true,

    reasonCodes,
  }
}

function recipePassesTimeConstraint({
  recipe,
  maxTimeMinutes,
}) {
  if (
    !maxTimeMinutes
  ) {
    return true
  }

  const totalTime =
    getRecipeTotalTimeMinutes(
      recipe,
    )

  return totalTime !==
    null &&
    totalTime <=
      maxTimeMinutes
}

function serializeRecipeCandidate({
  item,
  scoring,
  hardConstraintReasonCodes,
}) {
  const reasonCodes = [
    ...new Set([
      ...scoring.reasonCodes,
      ...hardConstraintReasonCodes,
    ]),
  ]

  return {
    type:
      'recipe',

    id:
      item.recipe.id,

    subjectId:
      item.recipe.id,

    displayName:
      item.dish.name ||
      item.recipe.title,

    subtitle: [
      item.dish.cuisine,
      item.dish.course,
    ]
      .filter(
        Boolean,
      )
      .join(
        ' · ',
      ),

    path:
      item.path,

    score:
      scoring.score,

    reasonCodes,

    reasons:
      explainReasonCodes(
        reasonCodes,
      ),

    meta: {
      cuisine:
        item.dish.cuisine ||
        null,

      course:
        item.dish.course ||
        null,

      totalTimeMinutes:
        getRecipeTotalTimeMinutes(
          item.recipe,
        ),

      baseServings:
        item.recipe.baseServings ??
        null,

      ingredientCoverageRatio:
        item.matching?.coverageRatio ??
        null,

      imageUrl:
        item.dish.heroImageUrl ||
        null,
    },
  }
}

async function retrieveRecipeCandidates({
  intent,
  resolvedIngredients,
  pantryContext,
}) {
  const queryIngredientIds =
    resolvedIngredients.map(
      (
        ingredient,
      ) =>
        ingredient.id,
    )

  const availableIngredientIds = [
    ...new Set([
      ...queryIngredientIds,
      ...(pantryContext.enabled
        ? pantryContext.confirmedIngredientIds
        : []),
    ]),
  ]

  let rawCandidates = []

  if (
    availableIngredientIds.length >
    0
  ) {
    const result =
      await getWhatShouldWeCook({
        ingredientIds:
          availableIngredientIds,

        limit:
          PER_SOURCE_LIMIT,
      })

    rawCandidates =
      result?.recipes ||
      []
  } else {
    const searchTerms =
      intent.contentTerms.length >
      0
        ? intent.contentTerms.slice(
            0,
            4,
          )
        : [
            '',
          ]

    const responses =
      await Promise.all(
        searchTerms.map(
          (
            search,
          ) =>
            listPublicRecipes({
              page:
                1,

              limit:
                PER_SOURCE_LIMIT,

              search,

              cuisine:
                intent.constraints.cuisine ||
                '',

              course:
                intent.constraints.course ||
                '',

              tag:
                '',
            }),
        ),
      )

    const byId =
      new Map()

    for (
      const response
      of responses
    ) {
      for (
        const item
        of response?.recipes ||
        []
      ) {
        if (
          item?.recipe?.id &&
          !byId.has(
            item.recipe.id,
          )
        ) {
          byId.set(
            item.recipe.id,
            item,
          )
        }
      }
    }

    rawCandidates = [
      ...byId.values(),
    ]
  }

  let pantryCoverageByRecipeId =
    new Map()

  if (
    pantryContext.enabled &&
    pantryContext.confirmedIngredientIds.length >
      0
  ) {
    const pantryMatches =
      await getWhatShouldWeCook({
        ingredientIds:
          pantryContext.confirmedIngredientIds,

        limit:
          100,
      })

    pantryCoverageByRecipeId =
      new Map(
        (
          pantryMatches?.recipes ||
          []
        ).map(
          (
            item,
          ) => [
            item.recipe.id,
            item.matching?.coverageRatio ??
              null,
          ],
        ),
      )
  }

  const candidates = []
  const blockedCodes = []

  for (
    const item
    of rawCandidates
  ) {
    if (
      !item?.recipe?.id ||
      !item?.dish?.id
    ) {
      continue
    }

    if (
      !recipePassesTimeConstraint({
        recipe:
          item.recipe,

        maxTimeMinutes:
          intent.constraints.maxTimeMinutes,
      })
    ) {
      blockedCodes.push(
        'TIME_CONSTRAINT_VIOLATED',
      )

      continue
    }

    const hardConstraints =
      await evaluateHardFoodConstraints({
        candidateType:
          'recipe',

        subjectId:
          item.recipe.id,

        constraints:
          intent.constraints,
      })

    if (
      !hardConstraints.allowed
    ) {
      if (
        hardConstraints.blockedCode
      ) {
        blockedCodes.push(
          hardConstraints.blockedCode,
        )
      }

      continue
    }

    const scoring =
      scoreRecipeSearchCandidate({
        item,
        intent,

        pantryCoverageRatio:
          pantryCoverageByRecipeId.get(
            item.recipe.id,
          ) ??
          null,
      })

    candidates.push(
      serializeRecipeCandidate({
        item,
        scoring,

        hardConstraintReasonCodes:
          hardConstraints.reasonCodes,
      }),
    )
  }

  return {
    candidates,

    blockedCodes: [
      ...new Set(
        blockedCodes,
      ),
    ],
  }
}

async function retrieveProductCandidates({
  intent,
}) {
  const searchTerms =
    intent.contentTerms.length >
    0
      ? intent.contentTerms.slice(
          0,
          4,
        )
      : intent.mode ===
        'product'
        ? [
            '',
          ]
        : []

  if (
    searchTerms.length ===
    0
  ) {
    return {
      candidates:
        [],

      blockedCodes:
        [],
    }
  }

  const responses =
    await Promise.all(
      searchTerms.map(
        (
          search,
        ) =>
          listPublicProducts({
            page:
              1,

            limit:
              PER_SOURCE_LIMIT,

            search,
          }),
      ),
    )

  const byId =
    new Map()

  for (
    const response
    of responses
  ) {
    for (
      const product
      of response?.products ||
      []
    ) {
      if (
        product?.productVersionId &&
        !byId.has(
          product.productVersionId,
        )
      ) {
        byId.set(
          product.productVersionId,
          product,
        )
      }
    }
  }

  const candidates = []
  const blockedCodes = []

  for (
    const product
    of byId.values()
  ) {
    const hardConstraints =
      await evaluateHardFoodConstraints({
        candidateType:
          'product',

        subjectId:
          product.productVersionId,

        constraints:
          intent.constraints,
      })

    if (
      !hardConstraints.allowed
    ) {
      if (
        hardConstraints.blockedCode
      ) {
        blockedCodes.push(
          hardConstraints.blockedCode,
        )
      }

      continue
    }

    const scoring =
      scoreSimpleSearchCandidate({
        candidateType:
          'product',

        displayName:
          `${product.displayName || ''} ${product.brand?.name || ''} ${product.family?.name || ''}`,

        terms:
          intent.contentTerms,
      })

    const reasonCodes = [
      ...new Set([
        ...scoring.reasonCodes,
        ...hardConstraints.reasonCodes,
      ]),
    ]

    candidates.push({
      type:
        'product',

      id:
        product.productVersionId,

      subjectId:
        product.productVersionId,

      displayName:
        product.displayName,

      subtitle: [
        product.brand?.name,
        product.pack?.name,
      ]
        .filter(
          Boolean,
        )
        .join(
          ' · ',
        ),

      path:
        `/grocery/product/${product.slug}`,

      score:
        scoring.score,

      reasonCodes,

      reasons:
        explainReasonCodes(
          reasonCodes,
        ),

      meta: {
        brandName:
          product.brand?.name ||
          null,

        categoryName:
          product.category?.name ||
          null,

        netQuantity:
          product.netQuantity ||
          null,

        imageUrl:
          product.image?.url ||
          null,
      },
    })
  }

  return {
    candidates,

    blockedCodes: [
      ...new Set(
        blockedCodes,
      ),
    ],
  }
}

function retrieveIngredientCandidates({
  intent,
  resolvedIngredients,
}) {
  if (
    ![
      'all',
      'ingredient',
    ].includes(
      intent.mode,
    )
  ) {
    return []
  }

  return resolvedIngredients.map(
    (
      ingredient,
    ) => {
      const scoring =
        scoreSimpleSearchCandidate({
          candidateType:
            'ingredient',

          displayName:
            `${ingredient.name} ${ingredient.aliases.join(' ')}`,

          terms:
            intent.contentTerms,
        })

      return {
        type:
          'ingredient',

        id:
          ingredient.id,

        subjectId:
          ingredient.id,

        displayName:
          ingredient.name,

        subtitle:
          'Canonical Ingredient',

        path:
          `/search?q=${encodeURIComponent(
            ingredient.name,
          )}&mode=recipe`,

        score:
          scoring.score,

        reasonCodes:
          scoring.reasonCodes,

        reasons:
          explainReasonCodes(
            scoring.reasonCodes,
          ),

        meta: {
          slug:
            ingredient.slug,

          aliases:
            ingredient.aliases.slice(
              0,
              5,
            ),
        },
      }
    },
  )
}

async function retrieveBrandCandidates({
  intent,
}) {
  if (
    ![
      'all',
      'brand',
    ].includes(
      intent.mode,
    ) ||
    intent.contentTerms.length ===
      0
  ) {
    return []
  }

  const brands =
    await listPublicBrands()

  const candidates = []

  for (
    const brand
    of brands
  ) {
    const scoring =
      scoreSimpleSearchCandidate({
        candidateType:
          'brand',

        displayName:
          brand.name,

        terms:
          intent.contentTerms,
      })

    if (
      scoring.reasonCodes.length ===
      0
    ) {
      continue
    }

    candidates.push({
      type:
        'brand',

      id:
        brand.id,

      subjectId:
        brand.id,

      displayName:
        brand.name,

      subtitle:
        'Brand',

      path:
        `/brands/${brand.slug}`,

      score:
        scoring.score,

      reasonCodes:
        scoring.reasonCodes,

      reasons:
        explainReasonCodes(
          scoring.reasonCodes,
        ),

      meta: {
        logoUrl:
          brand.logoUrl ||
          null,
      },
    })
  }

  return candidates.slice(
    0,
    PER_SOURCE_LIMIT,
  )
}

function getCandidateTypeCounts(
  candidates,
) {
  const counts = {
    recipe:
      0,

    product:
      0,

    ingredient:
      0,

    brand:
      0,
  }

  for (
    const candidate
    of candidates ||
    []
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        counts,
        candidate.type,
      )
    ) {
      counts[
        candidate.type
      ] +=
        1
    }
  }

  return counts
}

function getUnresolvedConstraintCodes({
  intent,
  pantryContext,
  blockedCodes,
}) {
  const codes = [
    ...(blockedCodes || []),
  ]

  if (
    intent.constraints.budgetMinor !==
    null
  ) {
    codes.push(
      'BUDGET_REQUIRES_COMMERCE_QUOTE',
    )
  }

  if (
    intent.constraints.commerceObjective ===
    'one_retailer'
  ) {
    codes.push(
      'ONE_RETAILER_REQUIRES_M11_FULFILLMENT_COMPARE',
    )
  }

  if (
    intent.constraints.usePantry &&
    pantryContext.requiresCustomer
  ) {
    codes.push(
      'PANTRY_CONTEXT_REQUIRES_CUSTOMER',
    )
  }

  if (
    intent.constraints.usePantry &&
    pantryContext.noHousehold
  ) {
    codes.push(
      'PANTRY_CONTEXT_REQUIRES_HOUSEHOLD',
    )
  }

  return [
    ...new Set(
      codes,
    ),
  ]
}

function buildSuggestions({
  candidates,
  intent,
  unresolvedConstraintCodes,
}) {
  if (
    candidates.length >
    0
  ) {
    const suggestions = [
      'Try “quicker” to refine the same search.',
      'Try “less spicy” or another explicit preference.',
      'Ask “why this?” from any result card.',
    ]

    if (
      !intent.constraints.usePantry
    ) {
      suggestions.push(
        'Add “use what I already have” for Customer Pantry context.',
      )
    }

    return suggestions.slice(
      0,
      4,
    )
  }

  const suggestions = [
    'Remove one hard constraint and search again.',
    'Try a broader ingredient or dish name.',
    'Increase the preparation-time limit.',
  ]

  if (
    unresolvedConstraintCodes.includes(
      'PANTRY_CONTEXT_REQUIRES_CUSTOMER',
    )
  ) {
    suggestions.unshift(
      'Sign in as a Customer before using Household Pantry context.',
    )
  }

  return suggestions.slice(
    0,
    4,
  )
}

async function executeSearchIntent({
  intent,
  actorContext,
}) {
  const resolvedIngredients =
    await resolveCanonicalIngredients(
      intent.contentTerms,
    )

  const pantryContext =
    await loadCustomerPantryContext({
      actorContext,

      usePantry:
        intent.constraints.usePantry,
    })

  const tasks = []

  const includeRecipes =
    [
      'all',
      'recipe',
    ].includes(
      intent.mode,
    )

  const includeProducts =
    [
      'all',
      'product',
    ].includes(
      intent.mode,
    )

  tasks.push(
    includeRecipes
      ? retrieveRecipeCandidates({
          intent,
          resolvedIngredients,
          pantryContext,
        })
      : Promise.resolve({
          candidates:
            [],

          blockedCodes:
            [],
        }),
  )

  tasks.push(
    includeProducts
      ? retrieveProductCandidates({
          intent,
        })
      : Promise.resolve({
          candidates:
            [],

          blockedCodes:
            [],
        }),
  )

  tasks.push(
    retrieveBrandCandidates({
      intent,
    }),
  )

  const [
    recipeResult,
    productResult,
    brandCandidates,
  ] =
    await Promise.all(
      tasks,
    )

  const ingredientCandidates =
    retrieveIngredientCandidates({
      intent,
      resolvedIngredients,
    })

  const candidates =
    sortSearchCandidates([
      ...recipeResult.candidates,
      ...productResult.candidates,
      ...ingredientCandidates,
      ...brandCandidates,
    ]).slice(
      0,
      SEARCH_RESULT_LIMIT,
    )

  const unresolvedConstraintCodes =
    getUnresolvedConstraintCodes({
      intent,
      pantryContext,

      blockedCodes: [
        ...recipeResult.blockedCodes,
        ...productResult.blockedCodes,
      ],
    })

  return {
    candidates,
    pantryContext,
    resolvedIngredients,
    unresolvedConstraintCodes,
  }
}

function serializeSearchSession({
  session,
  continuationToken,
  displayQuery,
}) {
  return {
    id:
      stringifyId(
        session._id,
      ),

    token:
      continuationToken,

    actorType:
      session.actorType,

    query:
      displayQuery,

    mode:
      session.mode,

    constraints:
      serializeConstraints(
        session.constraints,
      ),

    householdContextUsed:
      Boolean(
        session.householdId,
      ),
  }
}

async function createDecisionArtifacts({
  session,
  eventType,
  intent,
  execution,
}) {
  const counts =
    getCandidateTypeCounts(
      execution.candidates,
    )

  const event =
    await SearchEvent.create({
      sessionId:
        session._id,

      eventType,

      normalizedQuery:
        intent.normalizedQuery,

      mode:
        intent.mode,

      constraints:
        intent.constraints,

      resultCount:
        execution.candidates.length,

      candidateCountByType:
        counts,

      unresolvedConstraintCodes:
        execution.unresolvedConstraintCodes,

      occurredAt:
        new Date(),
    })

  const candidateSet =
    await CandidateSet.create({
      sessionId:
        session._id,

      searchEventId:
        event._id,

      candidates:
        execution.candidates.map(
          (
            candidate,
          ) => ({
            candidateType:
              candidate.type,

            candidateId:
              candidate.id,

            displayName:
              candidate.displayName,

            path:
              candidate.path ||
              '',

            score:
              candidate.score,

            reasonCodes:
              candidate.reasonCodes,
          }),
        ),

      generatedAt:
        new Date(),
    })

  const appliedHardConstraintCodes = []

  if (
    intent.constraints.maxTimeMinutes
  ) {
    appliedHardConstraintCodes.push(
      'MAX_TIME',
    )
  }

  if (
    intent.constraints.dietaryKeys.length >
    0
  ) {
    appliedHardConstraintCodes.push(
      'DIETARY',
    )
  }

  if (
    intent.constraints.excludedAllergens.length >
    0
  ) {
    appliedHardConstraintCodes.push(
      'ALLERGEN_EXCLUSION',
    )
  }

  const rankingDecision =
    await RankingDecision.create({
      sessionId:
        session._id,

      searchEventId:
        event._id,

      candidateSetId:
        candidateSet._id,

      strategy:
        'deterministic_organic_v1',

      appliedHardConstraintCodes,

      unresolvedConstraintCodes:
        execution.unresolvedConstraintCodes,

      selectedCandidateKeys:
        execution.candidates.map(
          (
            candidate,
          ) =>
            `${candidate.type}:${candidate.id}`,
        ),

      decidedAt:
        new Date(),
    })

  if (
    execution.candidates.length ===
    0
  ) {
    await SearchEvent.create({
      sessionId:
        session._id,

      eventType:
        'no_result',

      normalizedQuery:
        intent.normalizedQuery,

      mode:
        intent.mode,

      constraints:
        intent.constraints,

      resultCount:
        0,

      candidateCountByType:
        counts,

      unresolvedConstraintCodes:
        execution.unresolvedConstraintCodes,

      occurredAt:
        new Date(),
    })
  }

  return {
    event,
    candidateSet,
    rankingDecision,
    counts,
  }
}

function buildSearchResponse({
  session,
  continuationToken,
  displayQuery,
  execution,
  artifacts,
}) {
  return {
    session:
      serializeSearchSession({
        session,
        continuationToken,
        displayQuery,
      }),

    results:
      execution.candidates,

    resolvedEntities: {
      ingredients:
        execution.resolvedIngredients.map(
          (
            ingredient,
          ) => ({
            id:
              ingredient.id,

            name:
              ingredient.name,

            slug:
              ingredient.slug,
          }),
        ),
    },

    summary: {
      total:
        execution.candidates.length,

      byType:
        artifacts.counts,

      noResult:
        execution.candidates.length ===
        0,

      unresolvedConstraintCodes:
        execution.unresolvedConstraintCodes,

      deterministic:
        true,

      aiUsed:
        false,

      priceOrStockClaimed:
        false,
    },

    decision: {
      id:
        stringifyId(
          artifacts.rankingDecision._id,
        ),

      strategy:
        artifacts.rankingDecision.strategy,
    },

    suggestions:
      buildSuggestions({
        candidates:
          execution.candidates,

        intent: {
          constraints:
            serializeConstraints(
              session.constraints,
            ),
        },

        unresolvedConstraintCodes:
          execution.unresolvedConstraintCodes,
      }),
  }
}

export async function createSmartSearch({
  query,
  mode =
    'all',
  actorContext,
}) {
  const intent =
    parseDeterministicSearchIntent(
      query,
      {
        requestedMode:
          mode,
      },
    )

  const execution =
    await executeSearchIntent({
      intent,
      actorContext,
    })

  const continuationToken =
    createContinuationToken()

  const session =
    await SearchSession.create({
      actorType:
        getActorType(
          actorContext,
        ),

      ownerUserId:
        getOwnerUserId(
          actorContext,
        ),

      householdId:
        execution.pantryContext.householdId ||
        null,

      continuationTokenHash:
        hashContinuationToken(
          continuationToken,
        ),

      normalizedQuery:
        intent.normalizedQuery,

      mode:
        intent.mode,

      constraints:
        intent.constraints,

      status:
        'active',

      lastEventAt:
        new Date(),
    })

  const artifacts =
    await createDecisionArtifacts({
      session,
      eventType:
        'search',
      intent,
      execution,
    })

  return buildSearchResponse({
    session,
    continuationToken,
    displayQuery:
      intent.query,
    execution,
    artifacts,
  })
}

async function requireSearchSessionAccess({
  sessionId,
  sessionToken,
  actorContext,
}) {
  const session =
    await SearchSession.findById(
      sessionId,
    )
      .select(
        '+continuationTokenHash',
      )

  if (
    !session ||
    session.status !==
      'active'
  ) {
    throw new ApiError(
      404,
      'Search session was not found.',
      [
        {
          code:
            'SEARCH_SESSION_NOT_FOUND',
        },
      ],
    )
  }

  if (
    hashContinuationToken(
      sessionToken,
    ) !==
    session.continuationTokenHash
  ) {
    throw new ApiError(
      403,
      'Search session continuation token is invalid.',
      [
        {
          code:
            'SEARCH_SESSION_TOKEN_INVALID',
        },
      ],
    )
  }

  if (
    session.ownerUserId
  ) {
    const actorUserId =
      getOwnerUserId(
        actorContext,
      )

    if (
      !sameIdentifier(
        session.ownerUserId,
        actorUserId,
      )
    ) {
      throw new ApiError(
        403,
        'This Search session belongs to another Customer.',
        [
          {
            code:
              'SEARCH_SESSION_OWNER_MISMATCH',
          },
        ],
      )
    }
  }

  return session
}

export async function refineSmartSearch({
  sessionId,
  sessionToken,
  refinement,
  mode,
  actorContext,
}) {
  const session =
    await requireSearchSessionAccess({
      sessionId,
      sessionToken,
      actorContext,
    })

  const baseParsed =
    parseDeterministicSearchIntent(
      session.normalizedQuery,
      {
        requestedMode:
          session.mode,
      },
    )

  const baseIntent = {
    ...baseParsed,

    mode:
      session.mode,

    constraints:
      serializeConstraints(
        session.constraints,
      ),
  }

  const refinementIntent =
    parseDeterministicSearchIntent(
      refinement,
      {
        requestedMode:
          mode ||
          session.mode,
      },
    )

  const mergedIntent =
    mergeSearchIntent({
      baseIntent,
      refinementIntent,
    })

  mergedIntent.normalizedQuery =
    normalizeSearchText(
      `${session.normalizedQuery} ${refinementIntent.normalizedQuery}`,
    ).slice(
      0,
      500,
    )

  const execution =
    await executeSearchIntent({
      intent:
        mergedIntent,
      actorContext,
    })

  session.normalizedQuery =
    mergedIntent.normalizedQuery

  session.mode =
    mergedIntent.mode

  session.constraints =
    mergedIntent.constraints

  session.householdId =
    execution.pantryContext.householdId ||
    null

  session.lastEventAt =
    new Date()

  await session.save()

  const artifacts =
    await createDecisionArtifacts({
      session,
      eventType:
        'refine',
      intent:
        mergedIntent,
      execution,
    })

  return buildSearchResponse({
    session,
    continuationToken:
      sessionToken,

    displayQuery:
      mergedIntent.normalizedQuery,

    execution,
    artifacts,
  })
}

export async function explainSearchDecision({
  sessionId,
  sessionToken,
  candidateType,
  candidateId,
  actorContext,
}) {
  const session =
    await requireSearchSessionAccess({
      sessionId,
      sessionToken,
      actorContext,
    })

  const candidateSet =
    await CandidateSet.findOne({
      sessionId:
        session._id,

      candidates: {
        $elemMatch: {
          candidateType,
          candidateId,
        },
      },
    })
      .sort({
        generatedAt:
          -1,
      })
      .lean()

  if (
    !candidateSet
  ) {
    throw new ApiError(
      404,
      'Search result is not part of the current Search session.',
      [
        {
          code:
            'SEARCH_CANDIDATE_NOT_FOUND',
        },
      ],
    )
  }

  const candidate =
    candidateSet.candidates.find(
      (
        item,
      ) =>
        item.candidateType ===
          candidateType &&
        item.candidateId ===
          candidateId,
    )

  const decision =
    await RankingDecision.findOne({
      candidateSetId:
        candidateSet._id,
    }).lean()

  await SearchEvent.create({
    sessionId:
      session._id,

    eventType:
      'decision_explain',

    normalizedQuery:
      session.normalizedQuery,

    mode:
      session.mode,

    constraints:
      serializeConstraints(
        session.constraints,
      ),

    resultCount:
      1,

    candidateCountByType: {
      [candidateType]:
        1,
    },

    unresolvedConstraintCodes:
      decision?.unresolvedConstraintCodes ||
      [],

    occurredAt:
      new Date(),
  })

  return {
    candidate: {
      type:
        candidate.candidateType,

      id:
        candidate.candidateId,

      displayName:
        candidate.displayName,

      path:
        candidate.path,

      score:
        candidate.score,
    },

    reasons:
      explainReasonCodes(
        candidate.reasonCodes,
      ),

    transparency: {
      deterministic:
        true,

      aiUsed:
        false,

      strategy:
        decision?.strategy ||
        'deterministic_organic_v1',

      unresolvedConstraintCodes:
        decision?.unresolvedConstraintCodes ||
        [],

      statement:
        'This explanation comes from recorded deterministic ranking reasons. It does not invent Product, Pantry, safety, price or stock facts.',
    },
  }
}