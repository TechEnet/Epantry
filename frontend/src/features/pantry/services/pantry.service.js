import {
  apiClient,
} from '../../../api/apiClient'

export const PANTRY_ITEM_ACTIONS =
  Object.freeze({
    QUANTITY_CORRECTION:
      'manual_quantity_correction',

    FINISHED:
      'finished',

    BOUGHT_ELSEWHERE:
      'bought_elsewhere',

    STORAGE_UPDATE:
      'storage_update',

    USE_SOON:
      'use_soon',

    DO_NOT_TRACK:
      'do_not_track',
  })

export const PANTRY_OBSERVATION_TYPES =
  Object.freeze({
    I_HAVE_THIS:
      'manual_have',
  })

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

function normalizePositiveInteger(
  value,
  fallback,
  max,
) {
  const parsed =
    Number.parseInt(
      value,
      10,
    )

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed < 1
  ) {
    return fallback
  }

  return Math.min(
    parsed,
    max,
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

export function getPantryErrorMessage(
  error,
  fallback =
    'Unable to update your pantry right now.',
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    fallback
  )
}

export function normalizePantryItems(
  data,
) {
  if (
    Array.isArray(
      data,
    )
  ) {
    return data
  }

  if (
    Array.isArray(
      data?.items,
    )
  ) {
    return data.items
  }

  if (
    Array.isArray(
      data?.pantryItems,
    )
  ) {
    return data.pantryItems
  }

  return []
}

export async function getPantry({
  page =
    1,

  limit =
    50,

  state,
} = {}) {
  const response =
    await apiClient.get(
      '/pantry',

      {
        params: {
          page:
            normalizePositiveInteger(
              page,
              1,
              100000,
            ),

          limit:
            normalizePositiveInteger(
              limit,
              50,
              50,
            ),

          ...(state
            ? {
                state,
              }
            : {}),
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    items:
      normalizePantryItems(
        data,
      ),

    pagination:
      data?.pagination ||
      null,

    preferences:
      data?.preferences ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

export async function createPantryObservation({
  canonicalIngredientId,
  canonicalPackId,
  sourceType,
  observationType,
  quantity,
  storageZone,
  observedAt,
  occurredAt,
}) {
  const normalizedSourceType =
    String(
      sourceType ||
        observationType ||
        '',
    ).trim()

  if (!normalizedSourceType) {
    throw new Error(
      'Pantry observation source is required.',
    )
  }

  const payload = {
    sourceType:
      normalizedSourceType,
  }

  if (
    canonicalIngredientId
  ) {
    payload.canonicalIngredientId =
      canonicalIngredientId
  }

  if (
    canonicalPackId
  ) {
    payload.canonicalPackId =
      canonicalPackId
  }

  if (
    quantity
  ) {
    payload.quantity =
      quantity
  }

  if (
    storageZone
  ) {
    payload.storageZone =
      storageZone
  }

  const normalizedObservedAt =
    observedAt ||
    occurredAt

  if (
    normalizedObservedAt
  ) {
    payload.observedAt =
      normalizedObservedAt
  }

  return csrfRequest({
    method:
      'post',

    url:
      '/pantry/observations',

    data:
      payload,
  })
}

export async function confirmIHaveThis({
  canonicalIngredientId,
  canonicalPackId,
}) {
  if (
    !canonicalIngredientId &&
    !canonicalPackId
  ) {
    throw new Error(
      'A canonical Pantry identity is required.',
    )
  }

  return createPantryObservation({
    canonicalIngredientId,

    canonicalPackId,

    sourceType:
      PANTRY_OBSERVATION_TYPES
        .I_HAVE_THIS,
  })
}

export async function patchPantryItem(
  pantryItemId,
  payload,
) {
  return csrfRequest({
    method:
      'patch',

    url:
      `/pantry/items/${encodePathValue(
        pantryItemId,
      )}`,

    data:
      payload,
  })
}

export async function correctPantryQuantity(
  pantryItemId,
  {
    value,
    unit,
  },
) {
  const numericValue =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      numericValue,
    ) ||
    numericValue < 0
  ) {
    throw new Error(
      'Enter a valid quantity.',
    )
  }

  const normalizedUnit =
    String(
      unit ||
        '',
    )
      .trim()
      .toLowerCase()

  if (
    !normalizedUnit
  ) {
    throw new Error(
      'Quantity unit is required.',
    )
  }

  return patchPantryItem(
    pantryItemId,

    {
      sourceType:
        PANTRY_ITEM_ACTIONS
          .QUANTITY_CORRECTION,

      quantity: {
        mode:
          'exact',

        value:
          numericValue,

        unit:
          normalizedUnit,
      },
    },
  )
}

export async function markPantryItemFinished(
  pantryItemId,
) {
  return patchPantryItem(
    pantryItemId,

    {
      sourceType:
        PANTRY_ITEM_ACTIONS
          .FINISHED,
    },
  )
}

export async function markPantryItemBoughtElsewhere(
  pantryItemId,
) {
  return patchPantryItem(
    pantryItemId,

    {
      sourceType:
        PANTRY_ITEM_ACTIONS
          .BOUGHT_ELSEWHERE,
    },
  )
}

export async function updatePantryStorage(
  pantryItemId,
  storageZone,
) {
  const normalized =
    String(
      storageZone ||
        '',
    ).trim()

  if (!normalized) {
    throw new Error(
      'Storage zone is required.',
    )
  }

  return patchPantryItem(
    pantryItemId,

    {
      sourceType:
        PANTRY_ITEM_ACTIONS
          .STORAGE_UPDATE,

      storageZone:
        normalized,
    },
  )
}

export async function updatePantryUseSoon(
  pantryItemId,
  useSoonAt,
) {
  const normalized =
    String(
      useSoonAt ||
        '',
    ).trim()

  if (!normalized) {
    throw new Error(
      'Use-soon date is required.',
    )
  }

  return patchPantryItem(
    pantryItemId,

    {
      sourceType:
        PANTRY_ITEM_ACTIONS
          .USE_SOON,

      useSoonAt:
        normalized,
    },
  )
}

export async function stopTrackingPantryItem(
  pantryItemId,
) {
  return patchPantryItem(
    pantryItemId,

    {
      sourceType:
        PANTRY_ITEM_ACTIONS
          .DO_NOT_TRACK,
    },
  )
}

export async function getPantryItemHistory(
  pantryItemId,
  {
    page =
      1,

    limit =
      50,
  } = {},
) {
  const response =
    await apiClient.get(
      `/pantry/items/${encodePathValue(
        pantryItemId,
      )}/history`,

      {
        params: {
          page:
            normalizePositiveInteger(
              page,
              1,
              100000,
            ),

          limit:
            normalizePositiveInteger(
              limit,
              50,
              50,
            ),
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    item:
      data?.item ||
      data?.pantryItem ||
      null,

    observations:
      Array.isArray(
        data?.observations,
      )
        ? data.observations
        : Array.isArray(
              data?.history,
            )
          ? data.history
          : [],

    pagination:
      data?.pagination ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

export async function getPantryPreferences() {
  const response =
    await apiClient.get(
      '/pantry/preferences',
    )

  const data =
    unwrapApiData(
      response,
    )

  return (
    data?.preferences ||
    data ||
    null
  )
}

export async function updatePantryPreferences(
  changes,
) {
  return csrfRequest({
    method:
      'patch',

    url:
      '/pantry/preferences',

    data:
      changes,
  })
}

export async function getRecipePantry(
  recipeId,
  {
    targetServings =
      2,
  } = {},
) {
  const response =
    await apiClient.get(
      `/recipes/${encodePathValue(
        recipeId,
      )}/pantry`,

      {
        params: {
          targetServings:
            normalizePositiveInteger(
              targetServings,
              2,
              100,
            ),
        },
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return (
    data?.reconciliation ||
    data ||
    null
  )
}

export async function recordRecipeCooked(
  recipeId,
  {
    targetServings =
      2,

    idempotencyKey,
  },
) {
  const normalizedKey =
    String(
      idempotencyKey ||
        '',
    ).trim()

  if (!normalizedKey) {
    throw new Error(
      'An idempotency key is required before recording cooked Recipe consumption.',
    )
  }

  return csrfRequest({
    method:
      'post',

    url:
      `/recipes/${encodePathValue(
        recipeId,
      )}/cooked`,

    data: {
      targetServings:
        normalizePositiveInteger(
          targetServings,
          2,
          100,
        ),
    },

    headers: {
      'Idempotency-Key':
        normalizedKey,
    },
  })
}
export async function requestPantrySetupReminder(
  pantryItemId,
) {
  const normalizedId =
    String(
      pantryItemId ||
        '',
    ).trim()

  if (!normalizedId) {
    throw new Error(
      'Pantry item ID is required before creating a setup reminder.',
    )
  }

  return csrfRequest({
    method:
      'post',

    url:
      `/pantry/items/${encodePathValue(
        normalizedId,
      )}/setup-reminder`,

    data: {},
  })
}
