import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  normalizeCatalogSlug,
} from './catalog.constants.js'

import {
  getPublicProductBySlug,
  listPublicBrands,
  listPublicCategories,
  listPublicProducts,
} from './catalog.public.service.js'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function wrapController(
  handler,
) {
  return async function publicCatalogController(
    req,
    res,
    next,
  ) {
    try {
      return await handler(
        req,
        res,
      )
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

function sendSuccess(
  req,
  res,
  data,
  message,
) {
  return res
    .status(
      200,
    )
    .json(
      new ApiResponse(
        200,
        {
          ...data,

          requestId:
            req.requestId,
        },
        message,
      ),
    )
}

function normalizePaginationQuery(
  query,
) {
  const page =
    Math.max(
      1,
      Number(
        query?.page,
      ) ||
        1,
    )

  const limit =
    Math.min(
      100,
      Math.max(
        1,
        Number(
          query?.limit,
        ) ||
          24,
      ),
    )

  const search =
    String(
      query?.q ||
        query?.search ||
        '',
    )
      .trim()
      .slice(
        0,
        150,
      )

  const categorySlug =
    query?.category
      ? normalizeCatalogSlug(
          query.category,
        )
      : ''

  const brandSlug =
    query?.brand
      ? normalizeCatalogSlug(
          query.brand,
        )
      : ''

  const listedOnly =
    [
      '1',
      'true',
      'yes',
    ].includes(
      String(
        query?.listedOnly ||
          '',
      )
        .trim()
        .toLowerCase(),
    )

  return {
    page,

    limit,

    search,

    categorySlug,

    brandSlug,

    listedOnly,
  }
}

function requireSlug(
  value,
  label,
) {
  const normalized =
    normalizeCatalogSlug(
      value,
    )

  if (!normalized) {
    throw new ApiError(
      400,
      `A valid ${label} slug is required.`,
      [
        {
          code:
            'PUBLIC_CATALOG_SLUG_INVALID',
        },
      ],
    )
  }

  return normalized
}

/*
|--------------------------------------------------------------------------
| Products
|--------------------------------------------------------------------------
*/

export const listPublicProductsController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const result =
        await listPublicProducts(
          normalizePaginationQuery(
            req.query,
          ),
        )

      return sendSuccess(
        req,
        res,
        result,
        'Published products loaded',
      )
    },
  )

export const getPublicProductController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const product =
        await getPublicProductBySlug(
          req.params.slug,
        )

      return sendSuccess(
        req,
        res,
        {
          product,
        },
        'Published product loaded',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| Categories
|--------------------------------------------------------------------------
*/

export const listPublicCategoriesController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const categories =
        await listPublicCategories()

      return sendSuccess(
        req,
        res,
        {
          categories,
        },
        'Catalog categories loaded',
      )
    },
  )

export const listPublicCategoryProductsController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const categorySlug =
        requireSlug(
          req.params.slug,
          'Category',
        )

      const query =
        normalizePaginationQuery(
          req.query,
        )

      const result =
        await listPublicProducts({
          ...query,

          categorySlug,
        })

      return sendSuccess(
        req,
        res,
        result,
        'Category products loaded',
      )
    },
  )

/*
|--------------------------------------------------------------------------
| Brands
|--------------------------------------------------------------------------
*/

export const listPublicBrandsController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const brands =
        await listPublicBrands()

      return sendSuccess(
        req,
        res,
        {
          brands,
        },
        'Catalog brands loaded',
      )
    },
  )

export const listPublicBrandProductsController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const brandSlug =
        requireSlug(
          req.params.slug,
          'Brand',
        )

      const query =
        normalizePaginationQuery(
          req.query,
        )

      const result =
        await listPublicProducts({
          ...query,

          brandSlug,
        })

      return sendSuccess(
        req,
        res,
        result,
        'Brand products loaded',
      )
    },
  )