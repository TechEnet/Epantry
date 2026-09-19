import {
  z,
} from 'zod'

import {
  BRAND_AUTHORITY_SCOPES,
  BRAND_CLAIM_STATUSES,
  BRAND_IDENTITY_CHECK_STATUSES,
  normalizeBrandAuthorityKey,
  normalizeBrandMarketCode,
} from './brandAuthority.constants.js'

const objectIdPattern =
  /^[a-fA-F0-9]{24}$/

export const adminBrandAuthorityObjectIdSchema =
  z
    .string()
    .trim()
    .regex(
      objectIdPattern,
      'A valid MongoDB ObjectId is required.',
    )

const marketCodeSchema =
  z
    .string()
    .trim()
    .transform(
      normalizeBrandMarketCode,
    )
    .refine(
      (
        value,
      ) =>
        /^[A-Z]{2}$/.test(
          value,
        ),
      {
        message:
          'Market code must be a two-letter code.',
      },
    )

const subBrandKeySchema =
  z
    .string()
    .trim()
    .min(
      1,
    )
    .max(
      180,
    )
    .transform(
      normalizeBrandAuthorityKey,
    )
    .refine(
      Boolean,
      {
        message:
          'Sub-brand key is invalid.',
      },
    )

const dateTimeSchema =
  z
    .string()
    .datetime({
      offset:
        true,
    })

export const listAdminBrandClaimsQuerySchema =
  z
    .object({
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

      status:
        z
          .enum([
            'all',
            ...BRAND_CLAIM_STATUSES,
          ])
          .default(
            'pending_review',
          ),

      brandId:
        adminBrandAuthorityObjectIdSchema
          .optional(),

      organizationId:
        adminBrandAuthorityObjectIdSchema
          .optional(),
    })
    .strict()

export const adminBrandClaimIdParamsSchema =
  z
    .object({
      id:
        adminBrandAuthorityObjectIdSchema,
    })
    .strict()

export const adminBrandIdentityCheckIdParamsSchema =
  z
    .object({
      id:
        adminBrandAuthorityObjectIdSchema,
    })
    .strict()

export const reviewBrandIdentityCheckSchema =
  z
    .object({
      decision:
        z.enum([
          'verified',
          'rejected',
          'conflict',
        ]),

      reason:
        z
          .string()
          .trim()
          .min(
            3,
          )
          .max(
            4000,
          ),
    })
    .strict()

export const approveBrandClaimSchema =
  z
    .object({
      marketCodes:
        z
          .array(
            marketCodeSchema,
          )
          .min(
            1,
          )
          .max(
            50,
          )
          .transform(
            (
              values,
            ) => [
              ...new Set(
                values,
              ),
            ],
          ),

      scopes:
        z
          .array(
            z.enum(
              BRAND_AUTHORITY_SCOPES,
            ),
          )
          .min(
            1,
          )
          .max(
            BRAND_AUTHORITY_SCOPES.length,
          )
          .transform(
            (
              values,
            ) => [
              ...new Set(
                values,
              ),
            ],
          ),

      productFamilyIds:
        z
          .array(
            adminBrandAuthorityObjectIdSchema,
          )
          .max(
            500,
          )
          .optional()
          .default(
            [],
          )
          .transform(
            (
              values,
            ) => [
              ...new Set(
                values,
              ),
            ],
          ),

      subBrandKeys:
        z
          .array(
            subBrandKeySchema,
          )
          .max(
            100,
          )
          .optional()
          .default(
            [],
          )
          .transform(
            (
              values,
            ) => [
              ...new Set(
                values,
              ),
            ],
          ),

      validFrom:
        dateTimeSchema
          .optional(),

      validUntil:
        dateTimeSchema
          .optional()
          .nullable(),

      reason:
        z
          .string()
          .trim()
          .min(
            3,
          )
          .max(
            4000,
          ),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.validFrom &&
          value.validUntil &&
          new Date(
            value.validUntil,
          ) <=
            new Date(
              value.validFrom,
            )
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'validUntil',
            ],

            message:
              'validUntil must be later than validFrom.',
          })
        }
      },
    )

export const rejectBrandClaimSchema =
  z
    .object({
      reason:
        z
          .string()
          .trim()
          .min(
            3,
          )
          .max(
            4000,
          ),
    })
    .strict()

export const brandAuthorityGrantIdParamsSchema =
  z
    .object({
      id:
        adminBrandAuthorityObjectIdSchema,
    })
    .strict()

export const changeBrandAuthorityLifecycleSchema =
  z
    .object({
      action:
        z.enum([
          'suspend',
          'revoke',
        ]),

      reason:
        z
          .string()
          .trim()
          .min(
            3,
          )
          .max(
            4000,
          ),
    })
    .strict()

export const listAdminBrandAuthoritiesQuerySchema =
  z
    .object({
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

      status:
        z
          .enum([
            'all',
            'active',
            'suspended',
            'revoked',
            'expired',
          ])
          .default(
            'all',
          ),

      brandId:
        adminBrandAuthorityObjectIdSchema
          .optional(),

      organizationId:
        adminBrandAuthorityObjectIdSchema
          .optional(),
    })
    .strict()

export function isAdminIdentityDecisionStatus(
  value,
) {
  return [
    'verified',
    'rejected',
    'conflict',
  ].includes(
    value,
  )
}

export function isKnownIdentityStatus(
  value,
) {
  return BRAND_IDENTITY_CHECK_STATUSES.includes(
    value,
  )
}