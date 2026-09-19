import {
  apiClient,
} from '../../../api/apiClient'

function unwrapApiData(
  response,
) {
  if (
    response?.data &&
    typeof response.data ===
      'object' &&
    Object.prototype.hasOwnProperty.call(
      response.data,
      'success',
    )
  ) {
    return response
      .data
      .data
  }

  if (
    response &&
    typeof response ===
      'object' &&
    Object.prototype.hasOwnProperty.call(
      response,
      'success',
    )
  ) {
    return response.data
  }

  return response?.data ??
    response
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

function normalizePositiveNumber(
  value,
  fallback =
    2,
) {
  const parsed =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed <= 0
  ) {
    return fallback
  }

  return Math.min(
    parsed,
    1000,
  )
}

async function getCsrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const data =
    unwrapApiData(
      response,
    )

  const csrfToken =
    data?.csrfToken

  if (!csrfToken) {
    throw new Error(
      'Unable to obtain CSRF protection token.',
    )
  }

  return csrfToken
}

async function csrfRequest({
  method,
  url,
  data,
  headers = {},
}) {
  const csrfToken =
    await getCsrfToken()

  const response =
    await apiClient.request({
      method,

      url,

      data,

      headers: {
        ...headers,

        'x-csrf-token':
          csrfToken,
      },
    })

  return unwrapApiData(
    response,
  )
}

function requireIdempotencyKey(
  idempotencyKey,
) {
  const normalized =
    String(
      idempotencyKey ||
        '',
    ).trim()

  if (
    normalized.length <
    8
  ) {
    throw new Error(
      'A valid idempotency key is required.',
    )
  }

  return normalized
}

export function createOutcomePlanIdempotencyKey(
  prefix =
    'outcome-plan',
) {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return [
    prefix,

    Date.now(),

    Math.random()
      .toString(
        36,
      )
      .slice(
        2,
      ),
  ].join(
    '-',
  )
}

export function getOutcomePlanErrorMessage(
  error,
  fallback =
    'Unable to update your Outcome Plan right now.',
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    fallback
  )
}

export async function createOutcomePlan({
  recipeId,
  targetServings =
    2,
  idempotencyKey,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/outcome-plans',

    data: {
      recipeId:
        String(
          recipeId ||
            '',
        ).trim(),

      targetServings:
        normalizePositiveNumber(
          targetServings,
        ),
    },

    headers: {
      'Idempotency-Key':
        requireIdempotencyKey(
          idempotencyKey,
        ),
    },
  })
}

export async function createRecipeOutcomePlan(
  recipeId,
  {
    targetServings =
      2,

    purchaseMode =
      'missing_only',

    selectedCanonicalIngredientIds =
      [],

    idempotencyKey,
  } = {},
) {
  return csrfRequest({
    method:
      'post',

    url:
      `/recipes/${encodePathValue(
        recipeId,
      )}/outcome-plan`,

    data: {
      targetServings:
        normalizePositiveNumber(
          targetServings,
        ),

      purchaseMode:
        purchaseMode ===
        'full_recipe'
          ? 'full_recipe'
          : 'missing_only',

      ...(Array.isArray(
        selectedCanonicalIngredientIds,
      ) &&
      selectedCanonicalIngredientIds.length >
        0
        ? {
            selectedCanonicalIngredientIds:
              [
                ...new Set(
                  selectedCanonicalIngredientIds
                    .map(
                      (value) =>
                        String(
                          value ||
                            '',
                        ).trim(),
                    )
                    .filter(
                      Boolean,
                    ),
                ),
              ],
          }
        : {}),
    },

    headers: {
      'Idempotency-Key':
        requireIdempotencyKey(
          idempotencyKey,
        ),
    },
  })
}

export async function getOutcomePlan(
  planId,
) {
  const response =
    await apiClient.get(
      `/outcome-plans/${encodePathValue(
        planId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function updateOutcomePlanRequirements(
  planId,
  {
    targetServings,
    decisions,
    idempotencyKey,
  } = {},
) {
  const payload = {}

  if (
    targetServings !==
    undefined
  ) {
    payload.targetServings =
      normalizePositiveNumber(
        targetServings,
      )
  }

  if (
    Array.isArray(
      decisions,
    ) &&
    decisions.length >
      0
  ) {
    payload.decisions =
      decisions.map(
        (
          decision,
        ) => ({
          requirementLineId:
            String(
              decision
                .requirementLineId ||
                '',
            ).trim(),

          action:
            decision.action,
        }),
      )
  }

  return csrfRequest({
    method:
      'patch',

    url:
      `/outcome-plans/${encodePathValue(
        planId,
      )}/requirements`,

    data:
      payload,

    headers: {
      'Idempotency-Key':
        requireIdempotencyKey(
          idempotencyKey,
        ),
    },
  })
}