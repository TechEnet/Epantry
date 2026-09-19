import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  getPublicBrandProductHistory,
  getPublicBrandWorld,
  listPublicBrandWorlds,
} from './brandAuthority.public.service.js'

import {
  listPublicBrandsQuerySchema,
  publicBrandHistoryParamsSchema,
  publicBrandKeyParamsSchema,
} from './brandAuthority.public.validation.js'

function parseOrThrow(
  schema,
  input,
) {
  const result =
    schema.safeParse(
      input,
    )

  if (
    !result.success
  ) {
    throw new ApiError(
      400,
      'Invalid Brand World request.',
      result.error.issues.map(
        (
          issue,
        ) => ({
          code:
            'VALIDATION_ERROR',

          field:
            issue.path.join(
              '.',
            ),

          message:
            issue.message,
        }),
      ),
    )
  }

  return result.data
}

export async function listPublicBrandsController(
  req,
  res,
) {
  const query =
    parseOrThrow(
      listPublicBrandsQuerySchema,
      req.query,
    )

  const data =
    await listPublicBrandWorlds(
      query,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brands loaded successfully.',

      data,
    })
}

export async function getPublicBrandWorldController(
  req,
  res,
) {
  const {
    brandKey,
  } =
    parseOrThrow(
      publicBrandKeyParamsSchema,
      req.params,
    )

  const data =
    await getPublicBrandWorld(
      brandKey,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Brand World loaded successfully.',

      data,
    })
}

export async function getPublicBrandProductHistoryController(
  req,
  res,
) {
  const params =
    parseOrThrow(
      publicBrandHistoryParamsSchema,
      req.params,
    )

  const data =
    await getPublicBrandProductHistory(
      params,
    )

  return res
    .status(
      200,
    )
    .json({
      success:
        true,

      message:
        'Product version history loaded successfully.',

      data,
    })
}