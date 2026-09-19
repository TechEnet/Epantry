import {
  apiClient,
} from '../../../api/apiClient'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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

function normalizeString(
  value,
) {
  return String(
    value ||
      '',
  ).trim()
}

function encodePathValue(
  value,
) {
  return encodeURIComponent(
    normalizeString(
      value,
    ),
  )
}

function normalizeQueryParams(
  values,
) {
  const result = {}

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      values ||
        {},
    )
  ) {
    if (
      value ===
        undefined ||
      value ===
        null ||
      value ===
        ''
    ) {
      continue
    }

    result[key] =
      value
  }

  return result
}

function compactPayload(
  values,
) {
  const result = {}

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      values ||
        {},
    )
  ) {
    if (
      value ===
      undefined
    ) {
      continue
    }

    result[key] =
      value
  }

  return result
}

/*
|--------------------------------------------------------------------------
| Secure Mutation
|--------------------------------------------------------------------------
*/

async function requestCsrfToken() {
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
      'Unable to initialize secure Catalog request.',
    )
  }

  return csrfToken
}

async function performCatalogMutation({
  method,

  url,

  data =
    {},
}) {
  const csrfToken =
    await requestCsrfToken()

  const response =
    await apiClient.request({
      method,

      url,

      data,

      headers: {
        'x-csrf-token':
          csrfToken,
      },
    })

  return unwrapApiData(
    response,
  )
}

/*
|--------------------------------------------------------------------------
| Brands
|--------------------------------------------------------------------------
*/

export async function getAdminCatalogBrands(
  query =
    {},
) {
  const response =
    await apiClient.get(
      '/admin/catalog/brands',
      {
        params:
          normalizeQueryParams(
            query,
          ),
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function createAdminCatalogBrand(
  input,
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      '/admin/catalog/brands',

    data:
      compactPayload(
        input,
      ),
  })
}

export async function updateAdminCatalogBrand(
  brandId,
  input,
) {
  return performCatalogMutation({
    method:
      'patch',

    url:
      `/admin/catalog/brands/${encodePathValue(
        brandId,
      )}`,

    data:
      compactPayload(
        input,
      ),
  })
}

/*
|--------------------------------------------------------------------------
| Categories
|--------------------------------------------------------------------------
*/

export async function getAdminCatalogCategories(
  query =
    {},
) {
  const response =
    await apiClient.get(
      '/admin/catalog/categories',
      {
        params:
          normalizeQueryParams(
            query,
          ),
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function createAdminCatalogCategory(
  input,
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      '/admin/catalog/categories',

    data:
      compactPayload(
        input,
      ),
  })
}

export async function updateAdminCatalogCategory(
  categoryId,
  input,
) {
  return performCatalogMutation({
    method:
      'patch',

    url:
      `/admin/catalog/categories/${encodePathValue(
        categoryId,
      )}`,

    data:
      compactPayload(
        input,
      ),
  })
}

/*
|--------------------------------------------------------------------------
| Product Families
|--------------------------------------------------------------------------
*/

export async function getAdminProductFamilies(
  query =
    {},
) {
  const response =
    await apiClient.get(
      '/admin/catalog/product-families',
      {
        params:
          normalizeQueryParams(
            query,
          ),
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function createAdminProductFamily(
  input,
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      '/admin/catalog/product-families',

    data:
      compactPayload(
        input,
      ),
  })
}

export async function updateAdminProductFamily(
  familyId,
  input,
) {
  return performCatalogMutation({
    method:
      'patch',

    url:
      `/admin/catalog/product-families/${encodePathValue(
        familyId,
      )}`,

    data:
      compactPayload(
        input,
      ),
  })
}

/*
|--------------------------------------------------------------------------
| Product Variants
|--------------------------------------------------------------------------
*/

export async function getAdminProductVariants(
  query =
    {},
) {
  const response =
    await apiClient.get(
      '/admin/catalog/product-variants',
      {
        params:
          normalizeQueryParams(
            query,
          ),
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function createAdminProductVariant(
  input,
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      '/admin/catalog/product-variants',

    data:
      compactPayload(
        input,
      ),
  })
}

export async function updateAdminProductVariant(
  variantId,
  input,
) {
  return performCatalogMutation({
    method:
      'patch',

    url:
      `/admin/catalog/product-variants/${encodePathValue(
        variantId,
      )}`,

    data:
      compactPayload(
        input,
      ),
  })
}

/*
|--------------------------------------------------------------------------
| Packs
|--------------------------------------------------------------------------
*/

export async function getAdminProductPacks(
  query =
    {},
) {
  const response =
    await apiClient.get(
      '/admin/catalog/packs',
      {
        params:
          normalizeQueryParams(
            query,
          ),
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function createAdminProductPack(
  input,
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      '/admin/catalog/packs',

    data:
      compactPayload(
        input,
      ),
  })
}

export async function updateAdminProductPack(
  packId,
  input,
) {
  return performCatalogMutation({
    method:
      'patch',

    url:
      `/admin/catalog/packs/${encodePathValue(
        packId,
      )}`,

    data:
      compactPayload(
        input,
      ),
  })
}

/*
|--------------------------------------------------------------------------
| Product Versions
|--------------------------------------------------------------------------
*/

export async function getAdminProductVersions(
  query =
    {},
) {
  const response =
    await apiClient.get(
      '/admin/catalog/product-versions',
      {
        params:
          normalizeQueryParams(
            query,
          ),
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function getAdminProductVersion(
  versionId,
) {
  const response =
    await apiClient.get(
      `/admin/catalog/product-versions/${encodePathValue(
        versionId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function createAdminProductDraft(
  input,
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      '/admin/catalog/product-versions',

    data:
      compactPayload(
        input,
      ),
  })
}

export async function updateAdminProductDraft(
  versionId,
  input,
) {
  return performCatalogMutation({
    method:
      'patch',

    url:
      `/admin/catalog/product-versions/${encodePathValue(
        versionId,
      )}`,

    data:
      compactPayload(
        input,
      ),
  })
}

export async function updateAdminProductFacts(
  versionId,
  input,
) {
  return performCatalogMutation({
    method:
      'patch',

    url:
      `/admin/catalog/product-versions/${encodePathValue(
        versionId,
      )}/facts`,

    data:
      compactPayload(
        input,
      ),
  })
}

export async function submitAdminProductForReview(
  versionId,
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      `/admin/catalog/product-versions/${encodePathValue(
        versionId,
      )}/submit-review`,
  })
}

export async function createAdminNextProductVersion(
  versionId,
  {
    changeReason,
  },
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      `/admin/catalog/product-versions/${encodePathValue(
        versionId,
      )}/next-version`,

    data: {
      changeReason:
        normalizeString(
          changeReason,
        ),
    },
  })
}

/*
|--------------------------------------------------------------------------
| Publish Governance
|--------------------------------------------------------------------------
*/

export async function publishAdminProductVersion(
  versionId,
  {
    reasonCode,
    reasonDetails =
      '',
  },
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      `/admin/catalog/product-versions/${encodePathValue(
        versionId,
      )}/publish`,

    data: {
      reasonCode:
        normalizeString(
          reasonCode,
        ),

      reasonDetails:
        normalizeString(
          reasonDetails,
        ),
    },
  })
}

export async function retireAdminProductVersion(
  versionId,
  {
    reasonCode,
    reasonDetails,
  },
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      `/admin/catalog/product-versions/${encodePathValue(
        versionId,
      )}/retire`,

    data: {
      reasonCode:
        normalizeString(
          reasonCode,
        ),

      reasonDetails:
        normalizeString(
          reasonDetails,
        ),
    },
  })
}

/*
|--------------------------------------------------------------------------
| Ingredient Dictionary
|--------------------------------------------------------------------------
*/

export async function getAdminIngredients(
  query =
    {},
) {
  const response =
    await apiClient.get(
      '/admin/catalog/ingredients',
      {
        params:
          normalizeQueryParams(
            query,
          ),
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function createAdminIngredient(
  input,
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      '/admin/catalog/ingredients',

    data:
      compactPayload(
        input,
      ),
  })
}

export async function updateAdminIngredient(
  ingredientId,
  input,
) {
  return performCatalogMutation({
    method:
      'patch',

    url:
      `/admin/catalog/ingredients/${encodePathValue(
        ingredientId,
      )}`,

    data:
      compactPayload(
        input,
      ),
  })
}

/*
|--------------------------------------------------------------------------
| Evidence
|--------------------------------------------------------------------------
*/

export async function getAdminEvidenceSources({
  entityType,

  entityId,

  page =
    1,

  limit =
    50,
}) {
  const response =
    await apiClient.get(
      '/admin/catalog/evidence',
      {
        params: {
          entityType,

          entityId,

          page,

          limit,
        },
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function createAdminEvidenceSource(
  input,
) {
  return performCatalogMutation({
    method:
      'post',

    url:
      '/admin/catalog/evidence',

    data:
      compactPayload(
        input,
      ),
  })
}