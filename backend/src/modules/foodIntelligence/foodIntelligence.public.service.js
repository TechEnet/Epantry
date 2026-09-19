import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  Allergen,
  FoodCalculation,
  Nutrient,
} from './foodIntelligence.models.js'

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const UNCERTAIN_EVIDENCE_STATES =
  new Set([
    'inferred',
    'unknown_review_required',
    'unknown',
  ])

const CONFIDENT_EVIDENCE_STATES =
  new Set([
    'verified_source',
    'operator_declared',
    'calculated',
  ])

const PRODUCT_CALCULATION_TYPES =
  [
    'product',
    'product_version',
    'productVersion',
  ]

const RECIPE_CALCULATION_TYPES =
  [
    'recipe',
    'recipe_version',
    'recipeVersion',
  ]

/*
|--------------------------------------------------------------------------
| Safe Helpers
|--------------------------------------------------------------------------
*/

function asPlainObject(
  value,
) {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value,
    )
  ) {
    return {}
  }

  return value
}

function normalizeString(
  value,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return null
  }

  const normalized =
    String(
      value,
    ).trim()

  return normalized ||
    null
}

function humanizeFoodKey(
  value,
) {
  const normalized =
    normalizeString(
      value,
    )

  if (!normalized) {
    return null
  }

  return normalized
    .replace(
      /_/g,
      ' ',
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    )
}

function normalizeNumber(
  value,
) {
  const number =
    Number(
      value,
    )

  return Number.isFinite(
    number,
  )
    ? number
    : null
}

function normalizeBoolean(
  value,
) {
  return typeof value ===
    'boolean'
    ? value
    : null
}

function readPath(
  value,
  path,
) {
  return path
    .split(
      '.',
    )
    .reduce(
      (
        current,
        key,
      ) =>
        current &&
        typeof current ===
          'object'
          ? current[key]
          : undefined,
      value,
    )
}

function readFirst(
  value,
  paths,
) {
  for (
    const path
    of paths
  ) {
    const candidate =
      readPath(
        value,
        path,
      )

    if (
      candidate !==
        undefined &&
      candidate !==
        null
    ) {
      return candidate
    }
  }

  return undefined
}

function normalizeArrayLike(
  value,
) {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value
  }

  if (
    value &&
    typeof value ===
      'object'
  ) {
    return Object.entries(
      value,
    ).map(
      ([
        key,
        item,
      ]) => {
        if (
          item &&
          typeof item ===
            'object' &&
          !Array.isArray(
            item,
          )
        ) {
          return {
            key,

            ...item,
          }
        }

        return {
          key,

          value:
            item,
        }
      },
    )
  }

  return []
}

/*
|--------------------------------------------------------------------------
| Nutrition
|--------------------------------------------------------------------------
*/

function normalizeNutrient(
  raw,
) {
  const item =
    asPlainObject(
      raw,
    )

  return {
    key:
      normalizeString(
        readFirst(
          item,
          [
            'nutrientKey',
            'key',
            'code',
          ],
        ),
      ),

    nutrientId:
      normalizeString(
        readFirst(
          item,
          [
            'nutrientId',
            'id',
          ],
        ),
      ),

    name:
      normalizeString(
        readFirst(
          item,
          [
            'name',
            'label',
            'nutrientName',
          ],
        ),
      ),

    amount:
      normalizeNumber(
        readFirst(
          item,
          [
            'amount',
            'quantity',
            'value',
          ],
        ),
      ),

    unit:
      normalizeString(
        readFirst(
          item,
          [
            'unit',
            'canonicalUnit',
          ],
        ),
      ),

    evidenceState:
      normalizeString(
        readFirst(
          item,
          [
            'evidenceState',
            'confidenceState',
          ],
        ),
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Allergens
|--------------------------------------------------------------------------
*/

function normalizeAllergen(
  raw,
) {
  const item =
    asPlainObject(
      raw,
    )

  return {
    key:
      normalizeString(
        readFirst(
          item,
          [
            'allergenKey',
            'key',
            'code',
          ],
        ),
      ),

    allergenId:
      normalizeString(
        readFirst(
          item,
          [
            'allergenId',
            'id',
          ],
        ),
      ),

    name:
      normalizeString(
        readFirst(
          item,
          [
            'name',
            'label',
            'allergenName',
          ],
        ),
      ),

    relationship:
      normalizeString(
        readFirst(
          item,
          [
            'relationship',
            'relationType',
            'allergenRelationship',
            'outcome',
          ],
        ),
      ),

    evidenceState:
      normalizeString(
        readFirst(
          item,
          [
            'evidenceState',
            'confidenceState',
          ],
        ),
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Dietary Rules
|--------------------------------------------------------------------------
*/

function normalizeDietary(
  raw,
) {
  const item =
    asPlainObject(
      raw,
    )

  const eligible =
    normalizeBoolean(
      readFirst(
        item,
        [
          'eligible',
          'isEligible',
          'matches',
        ],
      ),
    )

  let status =
    normalizeString(
      readFirst(
        item,
        [
          'status',
          'result',
          'decision',
          'outcome',
        ],
      ),
    )

  if (
    !status &&
    eligible !==
      null
  ) {
    status =
      eligible
        ? 'eligible'
        : 'not_eligible'
  }

  return {
    key:
      normalizeString(
        readFirst(
          item,
          [
            'ruleKey',
            'profileKey',
            'dietaryKey',
            'key',
          ],
        ),
      ),

    name:
      normalizeString(
        readFirst(
          item,
          [
            'name',
            'label',
            'ruleName',
          ],
        ),
      ) ||
      humanizeFoodKey(
        readFirst(
          item,
          [
            'ruleKey',
            'profileKey',
            'dietaryKey',
            'key',
          ],
        ),
      ),

    status:
      status ||
      'cannot_verify',

    eligible,

    evidenceState:
      normalizeString(
        readFirst(
          item,
          [
            'evidenceState',
            'confidenceState',
          ],
        ),
      ),

    reason:
      normalizeString(
        readFirst(
          item,
          [
            'reason',
            'explanation',
          ],
        ),
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Source Lineage
|--------------------------------------------------------------------------
*/

function normalizeSourceLineageItem(
  raw,
) {
  const item =
    asPlainObject(
      raw,
    )

  return {
    sourceType:
      normalizeString(
        readFirst(
          item,
          [
            'sourceType',
            'type',
            'entityType',
          ],
        ),
      ),

    sourceId:
      normalizeString(
        readFirst(
          item,
          [
            'sourceId',
            'entityId',
            'id',
          ],
        ),
      ),

    sourceVersion:
      normalizeString(
        readFirst(
          item,
          [
            'sourceVersion',
            'version',
            'versionKey',
          ],
        ),
      ),

    evidenceSourceId:
      normalizeString(
        readFirst(
          item,
          [
            'evidenceSourceId',
          ],
        ),
      ),

    evidenceState:
      normalizeString(
        readFirst(
          item,
          [
            'evidenceState',
            'confidenceState',
          ],
        ),
      ),

    basis:
      normalizeString(
        readFirst(
          item,
          [
            'basis',
            'description',
          ],
        ),
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Rule Lineage
|--------------------------------------------------------------------------
*/

function normalizeRuleLineageItem(
  raw,
) {
  const item =
    asPlainObject(
      raw,
    )

  return {
    ruleProfileId:
      normalizeString(
        readFirst(
          item,
          [
            'ruleProfileId',
            'profileId',
            'id',
          ],
        ),
      ),

    ruleKey:
      normalizeString(
        readFirst(
          item,
          [
            'ruleKey',
            'profileKey',
            'key',
          ],
        ),
      ),

    ruleVersion:
      normalizeString(
        readFirst(
          item,
          [
            'ruleVersion',
            'version',
          ],
        ),
      ),

    jurisdiction:
      normalizeString(
        readFirst(
          item,
          [
            'jurisdiction',
          ],
        ),
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Evidence State
|--------------------------------------------------------------------------
*/

function normalizeCalculationEvidenceState(
  calculation,
) {
  return (
    normalizeString(
      readFirst(
        calculation,
        [
          'evidenceState',
          'overallEvidenceState',
          'confidenceState',
          'result.evidenceState',
          'results.evidenceState',
        ],
      ),
    ) ||
    'unknown_review_required'
  )
}

function collectEvidenceStates({
  calculationEvidenceState,
  nutrients,
  allergens,
  dietary,
}) {
  return [
    calculationEvidenceState,

    ...nutrients.map(
      (item) =>
        item.evidenceState,
    ),

    ...allergens.map(
      (item) =>
        item.evidenceState,
    ),

    ...dietary.map(
      (item) =>
        item.evidenceState,
    ),
  ].filter(
    Boolean,
  )
}

/*
|--------------------------------------------------------------------------
| Public Verification Status
|--------------------------------------------------------------------------
*/

export function derivePublicVerificationStatus({
  calculationEvidenceState,
  evidenceStates =
    [],
}) {
  if (
    evidenceStates.some(
      (state) =>
        UNCERTAIN_EVIDENCE_STATES.has(
          state,
        ),
    )
  ) {
    return 'cannot_verify'
  }

  switch (
    calculationEvidenceState
  ) {
    case 'verified_source':
      return 'verified'

    case 'calculated':
      return 'calculated'

    case 'operator_declared':
      return 'declared'

    default:
      return 'cannot_verify'
  }
}

function readCalculationAllergenStatement(
  calculation,
) {
  const inputs =
    Array.isArray(
      calculation?.inputs,
    )
      ? calculation.inputs
      : []

  for (const item of inputs) {
    const statement =
      normalizeString(
        item?.allergenStatement,
      )

    if (statement) {
      return statement
    }
  }

  return null
}

/*
|--------------------------------------------------------------------------
| Public Serializer
|--------------------------------------------------------------------------
*/

export function serializePublicFoodIntelligence({
  subjectType,
  subjectId,
  calculation =
    null,
}) {
  if (!calculation) {
    return {
      available:
        false,

      subject: {
        type:
          subjectType,

        id:
          String(
            subjectId,
          ),
      },

      verificationStatus:
        'cannot_verify',

      evidenceState:
        'unknown_review_required',

      customerMessage:
        'Food safety information cannot currently be verified from the approved evidence available to EPANTRY.',

      nutrition:
        [],

      allergens:
        [],

      allergenStatement:
        null,

      dietary:
        [],

      allergenDisclosure: {
        freeFromClaimGenerated:
          false,

        absenceStatus:
          'not_asserted',
      },

      lineage: {
        sources:
          [],

        rules:
          [],
      },

      calculation: {
        version:
          null,

        fingerprint:
          null,

        generatedAt:
          null,
      },
    }
  }

  const nutrition =
    normalizeArrayLike(
      readFirst(
        calculation,
        [
          'nutrition',
          'nutrients',
          'nutrientResults',
          'result.nutrition',
          'result.nutrients',
          'results.nutrition',
          'results.nutrients',
        ],
      ),
    ).map(
      normalizeNutrient,
    )

  const allergens =
    normalizeArrayLike(
      readFirst(
        calculation,
        [
          'allergens',
          'allergenResults',
          'result.allergens',
          'results.allergens',
        ],
      ),
    ).map(
      normalizeAllergen,
    )

  const allergenStatement =
    readCalculationAllergenStatement(
      calculation,
    )

  const dietary =
    normalizeArrayLike(
      readFirst(
        calculation,
        [
          'dietary',
          'dietaryResults',
          'dietaryRules',
          'result.dietary',
          'results.dietary',
        ],
      ),
    ).map(
      normalizeDietary,
    )

  const calculationEvidenceState =
    normalizeCalculationEvidenceState(
      calculation,
    )

  const evidenceStates =
    collectEvidenceStates({
      calculationEvidenceState,

      nutrients:
        nutrition,

      allergens,

      dietary,
    })

  const verificationStatus =
    derivePublicVerificationStatus({
      calculationEvidenceState,

      evidenceStates,
    })

  const sourceLineage =
    normalizeArrayLike(
      readFirst(
        calculation,
        [
          'sourceLineage',
          'sourceVersions',
          'lineage.sources',
          'sources',
        ],
      ),
    ).map(
      normalizeSourceLineageItem,
    )

  const ruleLineage =
    normalizeArrayLike(
      readFirst(
        calculation,
        [
          'ruleLineage',
          'ruleVersions',
          'lineage.rules',
          'rules',
        ],
      ),
    ).map(
      normalizeRuleLineageItem,
    )

  return {
    available:
      true,

    subject: {
      type:
        subjectType,

      id:
        String(
          subjectId,
        ),
    },

    verificationStatus,

    evidenceState:
      calculationEvidenceState,

    customerMessage:
      verificationStatus ===
        'cannot_verify'
        ? 'Some required food-safety evidence is incomplete or uncertain. EPANTRY cannot verify a stronger safety claim.'
        : verificationStatus ===
            'declared'
          ? subjectType ===
              'product_version'
            ? 'Nutrition, allergen and dietary information shown here was declared and approved by EPANTRY Super Admin from reviewed Product package and canonical evidence. It is not laboratory verification and does not create free-from claims.'
            : 'Nutrition, allergen and dietary information shown here was declared and approved by EPANTRY Super Admin from the reviewed Recipe formulation. It is not laboratory verification and does not create free-from claims.'
          : 'This Food Intelligence result is based on governed source and rule lineage.',

    nutrition,

    allergens,

    allergenStatement,

    dietary,

    /*
    |--------------------------------------------------------------------------
    | Fail-closed Free-from Boundary
    |--------------------------------------------------------------------------
    |
    | An empty allergen array NEVER means "allergen free".
    |
    | A future explicit free-from claim must have its own governed verified
    | evidence and policy workflow.
    |
    */

    allergenDisclosure: {
      freeFromClaimGenerated:
        false,

      absenceStatus:
        allergens.length ===
          0
          ? 'not_asserted'
          : 'relationships_reported',
    },

    lineage: {
      sources:
        sourceLineage,

      rules:
        ruleLineage,
    },

    calculation: {
      version:
        readFirst(
          calculation,
          [
            'calculationVersion',
            'version',
          ],
        ) ??
        null,

      fingerprint:
        normalizeString(
          readFirst(
            calculation,
            [
              'fingerprint',
              'calculationFingerprint',
              'reproducibilityFingerprint',
            ],
          ),
        ),

      generatedAt:
        readFirst(
          calculation,
          [
            'generatedAt',
            'calculatedAt',
            'createdAt',
          ],
        ) ??
        null,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Food Calculation Identity Resolution
|--------------------------------------------------------------------------
*/

const CALCULATION_IDENTITY_CANDIDATES =
  [
    {
      typePath:
        'entityType',

      idPath:
        'entityId',
    },

    {
      typePath:
        'subjectType',

      idPath:
        'subjectId',
    },

    {
      typePath:
        'targetType',

      idPath:
        'targetId',
    },

    {
      typePath:
        'sourceEntityType',

      idPath:
        'sourceEntityId',
    },

    {
      typePath:
        'subject.entityType',

      idPath:
        'subject.entityId',
    },

    {
      typePath:
        'target.type',

      idPath:
        'target.id',
    },
  ]

function hasCalculationSchemaPath(
  path,
) {
  return Boolean(
    FoodCalculation
      .schema
      .path(
        path,
      ),
  )
}

function resolveCalculationIdentityPaths() {
  return (
    CALCULATION_IDENTITY_CANDIDATES.find(
      (
        candidate,
      ) =>
        hasCalculationSchemaPath(
          candidate.idPath,
        ),
    ) ||
    null
  )
}

function resolveCalculationStatusPath() {
  const candidates =
    [
      'status',
      'calculationStatus',
      'reviewStatus',
      'lifecycleStatus',
    ]

  return (
    candidates.find(
      hasCalculationSchemaPath,
    ) ||
    null
  )
}

function buildCalculationSort() {
  const sort =
    {}

  if (
    hasCalculationSchemaPath(
      'calculationVersion',
    )
  ) {
    sort.calculationVersion =
      -1
  }

  if (
    hasCalculationSchemaPath(
      'version',
    )
  ) {
    sort.version =
      -1
  }

  if (
    hasCalculationSchemaPath(
      'approvedAt',
    )
  ) {
    sort.approvedAt =
      -1
  }

  sort.createdAt =
    -1

  return sort
}

function isApprovedCalculation(
  calculation,
) {
  if (!calculation) {
    return false
  }

  const status =
    normalizeString(
      readFirst(
        calculation,
        [
          'status',
          'calculationStatus',
          'reviewStatus',
          'lifecycleStatus',
        ],
      ),
    )

  if (status) {
    return status ===
      'approved'
  }

  return Boolean(
    readFirst(
      calculation,
      [
        'approvedAt',
        'approvedByUserId',
      ],
    ),
  )
}

async function findLatestApprovedCalculation({
  subjectId,
  subjectTypes,
}) {
  const identity =
    resolveCalculationIdentityPaths()

  if (!identity) {
    throw new ApiError(
      500,
      'Food Intelligence calculation identity schema is unavailable.',
      [
        {
          code:
            'FOOD_INTELLIGENCE_CALCULATION_IDENTITY_SCHEMA_MISSING',
        },
      ],
    )
  }

  const filter = {
    [identity.idPath]:
      subjectId,
  }

  if (
    identity.typePath &&
    hasCalculationSchemaPath(
      identity.typePath,
    )
  ) {
    filter[
      identity.typePath
    ] = {
      $in:
        subjectTypes,
    }
  }

  const statusPath =
    resolveCalculationStatusPath()

  if (statusPath) {
    filter[
      statusPath
    ] =
      'approved'
  }

  const calculations =
    await FoodCalculation
      .find(
        filter,
      )
      .sort(
        buildCalculationSort(),
      )
      .limit(
        statusPath
          ? 1
          : 25,
      )
      .lean()

  return (
    calculations.find(
      isApprovedCalculation,
    ) ||
    null
  )
}

async function enrichPublicFoodIntelligenceLabels(
  foodIntelligence,
) {
  const nutrition =
    Array.isArray(
      foodIntelligence?.nutrition,
    )
      ? foodIntelligence.nutrition
      : []

  const allergens =
    Array.isArray(
      foodIntelligence?.allergens,
    )
      ? foodIntelligence.allergens
      : []

  const nutrientIds = [
    ...new Set(
      nutrition
        .map(
          (
            item,
          ) =>
            item.nutrientId,
        )
        .filter(
          Boolean,
        ),
    ),
  ]

  const allergenIds = [
    ...new Set(
      allergens
        .map(
          (
            item,
          ) =>
            item.allergenId,
        )
        .filter(
          Boolean,
        ),
    ),
  ]

  const [
    nutrientRows,
    allergenRows,
  ] =
    await Promise.all([
      nutrientIds.length
        ? Nutrient
            .find({
              _id: {
                $in:
                  nutrientIds,
              },
            })
            .select(
              '_id key canonicalName canonicalUnit',
            )
            .lean()
        : [],

      allergenIds.length
        ? Allergen
            .find({
              _id: {
                $in:
                  allergenIds,
              },
            })
            .select(
              '_id key canonicalName',
            )
            .lean()
        : [],
    ])

  const nutrientById =
    new Map(
      nutrientRows.map(
        (
          row,
        ) => [
          String(
            row._id,
          ),
          row,
        ],
      ),
    )

  const allergenById =
    new Map(
      allergenRows.map(
        (
          row,
        ) => [
          String(
            row._id,
          ),
          row,
        ],
      ),
    )

  return {
    ...foodIntelligence,

    nutrition:
      nutrition.map(
        (
          item,
        ) => {
          const master =
            nutrientById.get(
              String(
                item.nutrientId ||
                '',
              ),
            )

          return {
            ...item,

            key:
              item.key ||
              master?.key ||
              null,

            name:
              item.name ||
              master?.canonicalName ||
              humanizeFoodKey(
                master?.key,
              ) ||
              'Nutrient',

            unit:
              item.unit ||
              master?.canonicalUnit ||
              null,
          }
        },
      ),

    allergens:
      allergens.map(
        (
          item,
        ) => {
          const master =
            allergenById.get(
              String(
                item.allergenId ||
                '',
              ),
            )

          return {
            ...item,

            key:
              item.key ||
              master?.key ||
              null,

            name:
              item.name ||
              master?.canonicalName ||
              humanizeFoodKey(
                master?.key,
              ) ||
              'Allergen',
          }
        },
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Product
|--------------------------------------------------------------------------
*/

export async function getPublicProductFoodIntelligence(
  productVersionId,
) {
  const version =
    await ProductVersion
      .findById(
        productVersionId,
      )
      .lean()

  if (
    !version ||
    version.publicationStatus !==
      'published'
  ) {
    throw new ApiError(
      404,
      'Published Product Version not found.',
      [
        {
          code:
            'FOOD_INTELLIGENCE_PRODUCT_NOT_PUBLIC',
        },
      ],
    )
  }

  const calculation =
    await findLatestApprovedCalculation({
      subjectId:
        version._id,

      subjectTypes:
        PRODUCT_CALCULATION_TYPES,
    })

  return enrichPublicFoodIntelligenceLabels(
    serializePublicFoodIntelligence({
      subjectType:
        'product_version',

      subjectId:
        version._id,

      calculation,
    }),
  )
}

/*
|--------------------------------------------------------------------------
| Recipe
|--------------------------------------------------------------------------
*/

function getRecipePublicationStatus(
  recipeVersion,
) {
  return normalizeString(
    readFirst(
      recipeVersion,
      [
        'publicationStatus',
        'lifecycleStatus',
        'status',
      ],
    ),
  )
}

export async function getPublicRecipeFoodIntelligence(
  recipeVersionId,
) {
  const version =
    await RecipeVersion
      .findById(
        recipeVersionId,
      )
      .lean()

  if (
    !version ||
    getRecipePublicationStatus(
      version,
    ) !==
      'published'
  ) {
    throw new ApiError(
      404,
      'Published Recipe Version not found.',
      [
        {
          code:
            'FOOD_INTELLIGENCE_RECIPE_NOT_PUBLIC',
        },
      ],
    )
  }

  const calculation =
    await findLatestApprovedCalculation({
      subjectId:
        version._id,

      subjectTypes:
        RECIPE_CALCULATION_TYPES,
    })

  return enrichPublicFoodIntelligenceLabels(
    serializePublicFoodIntelligence({
      subjectType:
        'recipe_version',

      subjectId:
        version._id,

      calculation,
    }),
  )
}

/*
|--------------------------------------------------------------------------
| Public Boundary
|--------------------------------------------------------------------------
|
| Marketplace price, inventory and serviceability models are intentionally
| absent from this module.
|
*/