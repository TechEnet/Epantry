import {
  z,
} from 'zod'

import {
  BRAND_AUTHORITY_STATUSES,
  BRAND_CONFLICT_SEVERITIES,
  BRAND_CONFLICT_STATUSES,
  BRAND_OVERRIDE_STATUSES,
} from './brandAuthority.constants.js'

const objectIdPattern =
  /^[a-fA-F0-9]{24}$/

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      objectIdPattern,
      'A valid MongoDB ObjectId is required.',
    )

const paginationShape = {
  page:
    z.coerce
      .number()
      .int()
      .min(
        1,
      )
      .default(
        1,
      ),

  limit:
    z.coerce
      .number()
      .int()
      .min(
        1,
      )
      .max(
        100,
      )
      .default(
        25,
      ),
}

export const hostBrandIdParamsSchema =
  z
    .object({
      brandId:
        objectIdSchema,
    })
    .strict()

export const listHostBrandAuthoritiesQuerySchema =
  z
    .object({
      ...paginationShape,

      status:
        z
          .enum([
            'all',
            ...BRAND_AUTHORITY_STATUSES,
          ])
          .default(
            'all',
          ),

      brandId:
        objectIdSchema
          .optional(),
    })
    .strict()

export const listWorkspaceContentOverridesQuerySchema =
  z
    .object({
      ...paginationShape,

      status:
        z
          .enum([
            'all',
            ...BRAND_OVERRIDE_STATUSES,
          ])
          .default(
            'all',
          ),

      brandId:
        objectIdSchema
          .optional(),

      packId:
        objectIdSchema
          .optional(),
    })
    .strict()

export const listAdminBrandConflictsQuerySchema =
  z
    .object({
      ...paginationShape,

      status:
        z
          .enum([
            'all',
            ...BRAND_CONFLICT_STATUSES,
          ])
          .default(
            'all',
          ),

      severity:
        z
          .enum([
            'all',
            ...BRAND_CONFLICT_SEVERITIES,
          ])
          .default(
            'all',
          ),

      brandId:
        objectIdSchema
          .optional(),
    })
    .strict()