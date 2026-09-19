import {
  apiClient,
} from '../../../api/apiClient'

function unwrap(
  response,
) {
  return (
    response?.data?.data ??
    response?.data ??
    null
  )
}

async function getCsrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const payload =
    unwrap(
      response,
    )

  const csrfToken =
    payload?.csrfToken ||
    response?.data?.csrfToken ||
    null

  if (!csrfToken) {
    throw new Error(
      'Unable to obtain CSRF token.',
    )
  }

  return csrfToken
}

async function protectedMutation({
  method,
  url,
  data,
  timeout,
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
      },

      ...(Number.isFinite(
        Number(
          timeout,
        ),
      )
        ? {
            timeout:
              Number(
                timeout,
              ),
          }
        : {}),
    })

  return unwrap(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Public Recipes
|--------------------------------------------------------------------------
*/

export async function listPublicRecipes(
  params = {},
) {
  const response =
    await apiClient.get(
      '/recipes',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function getPublicRecipe(
  slug,
) {
  const response =
    await apiClient.get(
      `/recipes/${encodeURIComponent(
        slug,
      )}`,
    )

  return unwrap(
    response,
  )
}

export async function getPublicRecipeHistory(
  slug,
  limit =
    50,
) {
  const response =
    await apiClient.get(
      `/recipes/${encodeURIComponent(
        slug,
      )}/history`,
      {
        params: {
          limit,
        },
      },
    )

  return unwrap(
    response,
  )
}

export async function scalePublicRecipe(
  slug,
  servings,
) {
  const response =
    await apiClient.get(
      `/recipes/${encodeURIComponent(
        slug,
      )}/scale`,
      {
        params: {
          servings,
        },
      },
    )

  return unwrap(
    response,
  )
}

export async function getWhatShouldWeCook(
  ingredientIds,
  limit =
    12,
) {
  const response =
    await apiClient.get(
      '/recipes/what-should-we-cook',
      {
        params: {
          ingredientIds:
            Array.isArray(
              ingredientIds,
            )
              ? ingredientIds.join(
                  ',',
                )
              : ingredientIds,

          limit,
        },
      },
    )

  return unwrap(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Admin Recipe Read APIs
|--------------------------------------------------------------------------
*/

export async function listAdminRecipes(
  params = {},
) {
  const response =
    await apiClient.get(
      '/admin/recipes',
      {
        params,
      },
    )

  return unwrap(
    response,
  )
}

export async function getAdminRecipeVersion(
  versionId,
) {
  const response =
    await apiClient.get(
      `/admin/recipes/versions/${encodeURIComponent(
        versionId,
      )}`,
    )

  return unwrap(
    response,
  )
}


/*
|--------------------------------------------------------------------------
| Recipe Image Upload
|--------------------------------------------------------------------------
*/

async function createRecipeImageUploadIntent(
  scope,
) {
  const url =
    scope ===
      'host'
      ? '/host/operations/recipes/image-upload-intent'
      : '/admin/recipes/image-upload-intent'

  return protectedMutation({
    method:
      'post',

    url,

    data: {},
  })
}

function appendCloudinaryParameter(
  formData,
  key,
  value,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return
  }

  formData.append(
    key,
    Array.isArray(
      value,
    )
      ? value.join(
          ',',
        )
      : String(
          value,
        ),
  )
}

export async function uploadRecipeImage({
  file,
  scope =
    'admin',
}) {
  if (
    typeof File !==
      'undefined' &&
    !(file instanceof File)
  ) {
    throw new Error(
      'Choose a valid Recipe image first.',
    )
  }

  if (!file) {
    throw new Error(
      'Choose a valid Recipe image first.',
    )
  }

  const data =
    await createRecipeImageUploadIntent(
      scope,
    )

  const intent =
    data?.uploadIntent

  if (
    !intent?.uploadUrl ||
    !intent?.apiKey ||
    !intent?.signature ||
    !intent?.signedParameters
  ) {
    throw new Error(
      'Recipe image upload intent is incomplete.',
    )
  }

  const maxBytes =
    Number(
      intent.constraints
        ?.maxBytes ||
        0,
    )

  const allowedMimeTypes =
    Array.isArray(
      intent.constraints
        ?.allowedMimeTypes,
    )
      ? intent.constraints
          .allowedMimeTypes
      : []

  if (
    maxBytes >
      0 &&
    file.size >
      maxBytes
  ) {
    throw new Error(
      'This Recipe image is larger than the allowed upload size.',
    )
  }

  if (
    allowedMimeTypes.length >
      0 &&
    !allowedMimeTypes.includes(
      file.type,
    )
  ) {
    throw new Error(
      'Use a JPEG, PNG, or WebP Recipe image.',
    )
  }

  const formData =
    new FormData()

  formData.append(
    'file',
    file,
  )

  formData.append(
    'api_key',
    intent.apiKey,
  )

  formData.append(
    'signature',
    intent.signature,
  )

  for (
    const [
      key,
      value,
    ] of Object.entries(
      intent.signedParameters,
    )
  ) {
    appendCloudinaryParameter(
      formData,
      key,
      value,
    )
  }

  const response =
    await fetch(
      intent.uploadUrl,
      {
        method:
          'POST',

        body:
          formData,
      },
    )

  let payload =
    null

  try {
    payload =
      await response.json()
  } catch {
    payload =
      null
  }

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        'Recipe image upload failed.',
    )
  }

  const heroImageUrl =
    String(
      payload?.secure_url ||
        payload?.url ||
        '',
    ).trim()

  if (!heroImageUrl) {
    throw new Error(
      'Recipe image upload did not return a usable image URL.',
    )
  }

  return {
    heroImageUrl,

    publicId:
      payload?.public_id ||
      '',

    width:
      Number(
        payload?.width ||
          0,
      ) ||
      null,

    height:
      Number(
        payload?.height ||
          0,
      ) ||
      null,
  }
}

export async function updateAdminRecipeHeroImage(
  dishId,
  heroImageUrl,
) {
  return protectedMutation({
    method:
      'patch',

    url:
      `/admin/recipes/${encodeURIComponent(
        dishId,
      )}/image`,

    data: {
      heroImageUrl:
        String(
          heroImageUrl ||
            '',
        ).trim(),
    },
  })
}

/*
|--------------------------------------------------------------------------
| Admin Recipe Draft APIs
|--------------------------------------------------------------------------
*/

export async function createAdminRecipe(
  payload,
) {
  return protectedMutation({
    method:
      'post',

    url:
      '/admin/recipes',

    data:
      payload,
  })
}

export async function updateAdminRecipeDraft(
  versionId,
  payload,
) {
  return protectedMutation({
    method:
      'patch',

    url:
      `/admin/recipes/versions/${encodeURIComponent(
        versionId,
      )}`,

    data:
      payload,
  })
}

export async function createNextAdminRecipeVersion(
  dishId,
  payload,
) {
  return protectedMutation({
    method:
      'post',

    url:
      `/admin/recipes/${encodeURIComponent(
        dishId,
      )}/versions`,

    data:
      payload,
  })
}

/*
|--------------------------------------------------------------------------
| Admin Recipe Governance APIs
|--------------------------------------------------------------------------
*/

export async function submitAdminRecipeForReview(
  versionId,
  reason,
) {
  return protectedMutation({
    method:
      'post',

    url:
      `/admin/recipes/versions/${encodeURIComponent(
        versionId,
      )}/submit-review`,

    data: {
      reason,
    },
  })
}

export async function reviewAdminRecipeVersion(
  versionId,
  payload,
) {
  return protectedMutation({
    method:
      'post',

    url:
      `/admin/recipes/versions/${encodeURIComponent(
        versionId,
      )}/review`,

    data:
      payload,
  })
}

export async function publishAdminRecipeVersion(
  versionId,
  payload,
) {
  return protectedMutation({
    method:
      'post',

    url:
      `/admin/recipes/versions/${encodeURIComponent(
        versionId,
      )}/publish`,

    data:
      payload,
  })
}

export async function changeAdminRecipeVersionLifecycle(
  versionId,
  payload,
) {
  return protectedMutation({
    method:
      'post',

    url:
      `/admin/recipes/versions/${encodeURIComponent(
        versionId,
      )}/lifecycle`,

    data:
      payload,
  })
}

export async function changeAdminDishLifecycle(
  dishId,
  payload,
) {
  return protectedMutation({
    method:
      'post',

    url:
      `/admin/recipes/${encodeURIComponent(
        dishId,
      )}/lifecycle`,

    data:
      payload,
  })
}
export async function generateAiCook(
  input,
) {
  return protectedMutation({
    method:
      'post',

    url:
      '/recipes/ai-cook',

    data:
      input,

    timeout:
      120000,
  })
}
