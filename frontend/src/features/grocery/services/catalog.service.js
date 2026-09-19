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

/*
|--------------------------------------------------------------------------
| Public Products
|--------------------------------------------------------------------------
*/

export async function getCatalogProducts({
  page =
    1,

  limit =
    24,

  search =
    '',

  categorySlug =
    '',

  brandSlug =
    '',

  listedOnly =
    false,
} = {}) {
  const response =
    await apiClient.get(
      '/catalog/products',
      {
        params:
          normalizeQueryParams({
            page,

            limit,

            q:
              normalizeString(
                search,
              ),

            category:
              normalizeString(
                categorySlug,
              ),

            brand:
              normalizeString(
                brandSlug,
              ),

            listedOnly:
              listedOnly
                ? 'true'
                : '',
          }),
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    products:
      Array.isArray(
        data?.products,
      )
        ? data.products
        : [],

    pagination:
      data?.pagination ||
      {
        page:
          1,

        limit:
          24,

        total:
          0,

        pages:
          0,
      },

    filter:
      data?.filter ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

export async function getCatalogProduct(
  productSlug,
) {
  const slug =
    encodePathValue(
      productSlug,
    )

  if (!slug) {
    throw new Error(
      'Product slug is required.',
    )
  }

  const response =
    await apiClient.get(
      `/catalog/products/${slug}`,
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    product:
      data?.product ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Categories
|--------------------------------------------------------------------------
*/

export async function getCatalogCategories() {
  const response =
    await apiClient.get(
      '/catalog/categories',
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    categories:
      Array.isArray(
        data?.categories,
      )
        ? data.categories
        : [],

    requestId:
      data?.requestId ||
      null,
  }
}

export async function getCatalogCategoryProducts({
  categorySlug,

  page =
    1,

  limit =
    24,

  search =
    '',

  brandSlug =
    '',
}) {
  const slug =
    encodePathValue(
      categorySlug,
    )

  if (!slug) {
    throw new Error(
      'Category slug is required.',
    )
  }

  const response =
    await apiClient.get(
      `/catalog/categories/${slug}/products`,
      {
        params:
          normalizeQueryParams({
            page,

            limit,

            q:
              normalizeString(
                search,
              ),

            brand:
              normalizeString(
                brandSlug,
              ),
          }),
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    products:
      Array.isArray(
        data?.products,
      )
        ? data.products
        : [],

    pagination:
      data?.pagination ||
      null,

    filter:
      data?.filter ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Brands
|--------------------------------------------------------------------------
*/

export async function getCatalogBrands() {
  const response =
    await apiClient.get(
      '/catalog/brands',
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    brands:
      Array.isArray(
        data?.brands,
      )
        ? data.brands
        : [],

    requestId:
      data?.requestId ||
      null,
  }
}

export async function getCatalogBrandProducts({
  brandSlug,

  page =
    1,

  limit =
    24,

  search =
    '',

  categorySlug =
    '',
}) {
  const slug =
    encodePathValue(
      brandSlug,
    )

  if (!slug) {
    throw new Error(
      'Brand slug is required.',
    )
  }

  const response =
    await apiClient.get(
      `/catalog/brands/${slug}/products`,
      {
        params:
          normalizeQueryParams({
            page,

            limit,

            q:
              normalizeString(
                search,
              ),

            category:
              normalizeString(
                categorySlug,
              ),
          }),
      },
    )

  const data =
    unwrapApiData(
      response,
    )

  return {
    products:
      Array.isArray(
        data?.products,
      )
        ? data.products
        : [],

    pagination:
      data?.pagination ||
      null,

    filter:
      data?.filter ||
      null,

    requestId:
      data?.requestId ||
      null,
  }
}