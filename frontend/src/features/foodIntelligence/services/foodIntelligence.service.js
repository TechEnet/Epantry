import {
  apiClient,
} from '../../../api/apiClient'

/*
|--------------------------------------------------------------------------
| Response
|--------------------------------------------------------------------------
*/

function unwrapApiData(
  response,
) {
  return (
    response?.data?.data ??
    response?.data ??
    response
  )
}

function encodePathValue(
  value,
) {
  return encodeURIComponent(
    String(
      value ||
        '',
    ).trim(),
  )
}

/*
|--------------------------------------------------------------------------
| CSRF
|--------------------------------------------------------------------------
*/

async function getCsrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const data =
    unwrapApiData(
      response,
    )

  const token =
    data?.csrfToken

  if (!token) {
    throw new Error(
      'Unable to initialize secure administrative request.',
    )
  }

  return token
}

async function postWithCsrf(
  path,
  payload,
) {
  const csrfToken =
    await getCsrfToken()

  const response =
    await apiClient.post(
      path,

      payload,

      {
        headers: {
          'x-csrf-token':
            csrfToken,
        },
      },
    )

  return unwrapApiData(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Public Food Intelligence
|--------------------------------------------------------------------------
*/

export async function getProductFoodIntelligence(
  productVersionId,
) {
  const response =
    await apiClient.get(
      `/products/${encodePathValue(
        productVersionId,
      )}/food-intelligence`,
    )

  const data =
    unwrapApiData(
      response,
    )

  return (
    data?.foodIntelligence ||
    null
  )
}

export async function getRecipeFoodIntelligence(
  recipeVersionId,
) {
  const response =
    await apiClient.get(
      `/recipes/${encodePathValue(
        recipeVersionId,
      )}/food-intelligence`,
    )

  const data =
    unwrapApiData(
      response,
    )

  return (
    data?.foodIntelligence ||
    null
  )
}

/*
|--------------------------------------------------------------------------
| Existing Product / Recipe Identity Resolver
|--------------------------------------------------------------------------
|
| ProductDetailPage and RecipeDetailPage remain frozen.
|
| These resolvers let the bridge attach Food Intelligence without rewriting
| those existing screens.
|
*/

function normalizeId(
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

  return /^[a-fA-F0-9]{24}$/.test(
    normalized,
  )
    ? normalized
    : null
}

function readFirstVersionId(
  value,
) {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return null
  }

  const directCandidates =
    [
      value.productVersionId,
      value.recipeVersionId,
      value.versionId,
      value.currentVersionId,
      value.publishedVersionId,
      value.currentVersion?.id,
      value.currentVersion?._id,
      value.version?.id,
      value.version?._id,
    ]

  for (
    const candidate
    of directCandidates
  ) {
    const normalized =
      normalizeId(
        candidate,
      )

    if (normalized) {
      return normalized
    }
  }

  const nestedCandidates =
    [
      value.product,
      value.recipe,
      value.data,
      value.current,
    ]

  for (
    const candidate
    of nestedCandidates
  ) {
    const normalized =
      readFirstVersionId(
        candidate,
      )

    if (normalized) {
      return normalized
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Last Safe Fallback
  |--------------------------------------------------------------------------
  |
  | Only use generic id if response does not expose a stronger version field.
  |
  */

  return (
    normalizeId(
      value.id,
    ) ||
    normalizeId(
      value._id,
    )
  )
}

export async function resolveProductVersionIdFromSlug(
  slug,
) {
  const response =
    await apiClient.get(
      `/catalog/products/${encodePathValue(
        slug,
      )}`,
    )

  return readFirstVersionId(
    unwrapApiData(
      response,
    ),
  )
}

export async function resolveRecipeVersionIdFromSlug(
  slug,
) {
  const response =
    await apiClient.get(
      `/recipes/${encodePathValue(
        slug,
      )}`,
    )

  return readFirstVersionId(
    unwrapApiData(
      response,
    ),
  )
}



export async function declareProductFoodIntelligence({
  productVersionId,
  nutritionBasis,
  nutrition,
  allergens,
  allergenStatement,
  dietary,
  basis,
  reason,
  jurisdictionCode =
    'IN',
}) {
  return postWithCsrf(
    `/admin/food-intelligence/products/${encodePathValue(
      productVersionId,
    )}/declare`,

    {
      jurisdictionCode,
      nutritionBasis,
      nutrition,
      allergens,
      allergenStatement,
      dietary,
      basis,
      reason,
    },
  )
}

export async function getAdminProductFoodIntelligenceLatest(
  productVersionId,
) {
  const response =
    await apiClient.get(
      `/admin/food-intelligence/products/${encodePathValue(
        productVersionId,
      )}/latest`,
    )

  return unwrapApiData(
    response,
  )
}

export async function declareRecipeFoodIntelligence({
  recipeVersionId,
  nutrition,
  allergens,
  dietaryClassification,
  basis,
  reason,
  jurisdictionCode =
    'IN',
}) {
  return postWithCsrf(
    `/admin/food-intelligence/recipes/${encodePathValue(
      recipeVersionId,
    )}/declare`,

    {
      jurisdictionCode,
      nutrition,
      allergens,
      dietaryClassification,
      basis,
      reason,
    },
  )
}

export async function getAdminRecipeFoodIntelligenceLatest(
  recipeVersionId,
) {
  const response =
    await apiClient.get(
      `/admin/food-intelligence/recipes/${encodePathValue(
        recipeVersionId,
      )}/latest`,
    )

  return unwrapApiData(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Admin Workspace Reads
|--------------------------------------------------------------------------
*/

export async function listFoodIngredientRelations({
  page =
    1,

  limit =
    50,
} = {}) {
  const response =
    await apiClient.get(
      '/admin/food-intelligence/ingredient-relations',

      {
        params: {
          page,

          limit,
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    records:
      Array.isArray(
        data?.ingredientRelations,
      )
        ? data.ingredientRelations
        : [],

    pagination:
      data?.pagination ||
      null,
  }
}

export async function listFoodRuleProfiles({
  page =
    1,

  limit =
    50,
} = {}) {
  const response =
    await apiClient.get(
      '/admin/food-intelligence/rule-profiles',

      {
        params: {
          page,

          limit,
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    records:
      Array.isArray(
        data?.ruleProfiles,
      )
        ? data.ruleProfiles
        : [],

    pagination:
      data?.pagination ||
      null,
  }
}

export async function listFoodCalculations({
  page =
    1,

  limit =
    50,
} = {}) {
  const response =
    await apiClient.get(
      '/admin/food-intelligence/calculations',

      {
        params: {
          page,

          limit,
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    records:
      Array.isArray(
        data?.calculations,
      )
        ? data.calculations
        : [],

    pagination:
      data?.pagination ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Existing Part 4 Critical Governance
|--------------------------------------------------------------------------
*/

export async function testFoodRule(
  payload,
) {
  return postWithCsrf(
    '/admin/food-rules/test',

    payload,
  )
}

export async function activateIngredientRelation({
  relationId,
  reasonDetails,
}) {
  return postWithCsrf(
    `/admin/food-intelligence/ingredient-relations/${encodePathValue(
      relationId,
    )}/activate`,

    {
      reasonCode:
        'trust_safety.enforcement',

      reasonDetails:
        String(
          reasonDetails ||
            '',
        ).trim(),
    },
  )
}

export async function activateFoodRule({
  ruleProfileId,
  reasonDetails,
}) {
  return postWithCsrf(
    `/admin/food-rules/${encodePathValue(
      ruleProfileId,
    )}/activate`,

    {
      reasonCode:
        'trust_safety.enforcement',

      reasonDetails:
        String(
          reasonDetails ||
            '',
        ).trim(),
    },
  )
}

export async function approveFoodCalculation({
  calculationId,
  reasonDetails,
}) {
  return postWithCsrf(
    `/admin/food-intelligence/calculations/${encodePathValue(
      calculationId,
    )}/approve`,

    {
      reason:
        String(
          reasonDetails ||
            '',
        ).trim(),
    },
  )
}