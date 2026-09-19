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
    return response.data.data
  }

  return response?.data ??
    response
}

function createIdempotencyKey(
  prefix =
    'planning',
) {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
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
  idempotencyKey,
}) {
  const csrfToken =
    await getCsrfToken()

  const response =
    await apiClient.request({
      method,

      url,

      data,

      headers: {
        'x-csrf-token':
          csrfToken,

        ...(idempotencyKey
          ? {
              'Idempotency-Key':
                idempotencyKey,
            }
          : {}),
      },
    })

  return unwrapApiData(
    response,
  )
}

export function getPlanningErrorMessage(
  error,
  fallback =
    'Unable to complete this planning action right now.',
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

export async function listMealPlans() {
  const response =
    await apiClient.get(
      '/meal-plans',
    )

  return unwrapApiData(
    response,
  )
}

export async function getMealPlan(
  mealPlanId,
) {
  const response =
    await apiClient.get(
      `/meal-plans/${encodeURIComponent(
        mealPlanId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function createMealPlan({
  title,
  horizonStart,
  horizonEnd,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/meal-plans',

    data: {
      title,

      horizonStart,

      horizonEnd,
    },

    idempotencyKey:
      createIdempotencyKey(
        'meal-plan',
      ),
  })
}

export async function deleteMealPlan({
  mealPlanId,
}) {
  return csrfRequest({
    method:
      'delete',

    url:
      `/meal-plans/${encodeURIComponent(
        mealPlanId,
      )}`,
  })
}

export async function addPlannedMeal({
  mealPlanId,
  recipeSlug,
  plannedAt,
  mealType,
  servings,
  priority =
    3,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      `/meal-plans/${encodeURIComponent(
        mealPlanId,
      )}/meals`,

    data: {
      recipeSlug,

      plannedAt,

      mealType,

      servings,

      priority,
    },

    idempotencyKey:
      createIdempotencyKey(
        'planned-meal',
      ),
  })
}

export async function updatePlannedMeal({
  plannedMealId,
  changes,
}) {
  return csrfRequest({
    method:
      'patch',

    url:
      `/planned-meals/${encodeURIComponent(
        plannedMealId,
      )}`,

    data:
      changes,
  })
}

export async function getNextBasket() {
  const response =
    await apiClient.get(
      '/next-basket',
    )

  return unwrapApiData(
    response,
  )
}

export async function getNextBasketPreferences() {
  const response =
    await apiClient.get(
      '/next-basket/preferences',
    )

  return unwrapApiData(
    response,
  )
}

export async function updateNextBasketPreferences(
  changes,
) {
  return csrfRequest({
    method:
      'patch',

    url:
      '/next-basket/preferences',

    data:
      changes,
  })
}

export async function submitNextBasketFeedback({
  predictionId,
  action,
  quantity,
  brandId,
  snoozeUntil,
  note,
}) {
  const payload = {
    action,

    ...(quantity
      ? {
          quantity,
        }
      : {}),

    ...(brandId
      ? {
          brandId,
        }
      : {}),

    ...(snoozeUntil
      ? {
          snoozeUntil,
        }
      : {}),

    ...(note
      ? {
          note,
        }
      : {}),
  }

  return csrfRequest({
    method:
      'post',

    url:
      `/next-basket/${encodeURIComponent(
        predictionId,
      )}/feedback`,

    data:
      payload,

    idempotencyKey:
      createIdempotencyKey(
        'next-basket-feedback',
      ),
  })
}

export async function getWasteReduction({
  horizonDays =
    7,
} = {}) {
  const response =
    await apiClient.get(
      '/waste-reduction',

      {
        params: {
          horizonDays,
        },
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function getNextPossibility({
  horizonDays =
    7,
} = {}) {
  const response =
    await apiClient.get(
      '/next-possibility',

      {
        params: {
          horizonDays,
        },
      },
    )

  return unwrapApiData(
    response,
  )
}