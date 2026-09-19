import {
  z,
} from 'zod'

import {
  BRAND_CLAIM_STATUSES,
  BRAND_CLAIM_TYPES,
  BRAND_IDENTITY_CHECK_STATUSES,
  BRAND_IDENTITY_CHECK_TYPES,
  normalizeBrandMarketCode,
} from './brandAuthority.constants.js'

const objectIdPattern =
  /^[a-fA-F0-9]{24}$/

export const brandAuthorityObjectIdSchema =
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

const optionalDateTimeSchema =
  z
    .string()
    .datetime({
      offset:
        true,
    })
    .optional()
    .nullable()

/*
|--------------------------------------------------------------------------
| Identity Evidence
|--------------------------------------------------------------------------
*/

export const createBrandIdentityCheckSchema =
  z
    .object({
      brandId:
        brandAuthorityObjectIdSchema,

      checkType:
        z.enum(
          BRAND_IDENTITY_CHECK_TYPES,
        ),

      evidenceReference:
        z
          .string()
          .trim()
          .min(
            1,
          )
          .max(
            2048,
          ),

      evidenceSummary:
        z
          .string()
          .trim()
          .max(
            6000,
          )
          .optional()
          .default(
            '',
          ),

      sourceAuthority:
        z
          .string()
          .trim()
          .max(
            300,
          )
          .optional()
          .default(
            '',
          ),

      externalReference:
        z
          .string()
          .trim()
          .max(
            500,
          )
          .optional()
          .default(
            '',
          ),

      effectiveFrom:
        optionalDateTimeSchema,

      effectiveTo:
        optionalDateTimeSchema,
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.effectiveFrom &&
          value.effectiveTo &&
          new Date(
            value.effectiveTo,
          ) <=
            new Date(
              value.effectiveFrom,
            )
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'effectiveTo',
            ],

            message:
              'effectiveTo must be later than effectiveFrom.',
          })
        }
      },
    )

export const listBrandIdentityChecksQuerySchema =
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

      brandId:
        brandAuthorityObjectIdSchema
          .optional(),

      status:
        z
          .enum([
            'all',
            ...BRAND_IDENTITY_CHECK_STATUSES,
          ])
          .default(
            'all',
          ),
    })
    .strict()

export const brandIdentityCheckIdParamsSchema =
  z
    .object({
      id:
        brandAuthorityObjectIdSchema,
    })
    .strict()

/*
|--------------------------------------------------------------------------
| Brand Claim
|--------------------------------------------------------------------------
*/

export const createBrandClaimSchema =
  z
    .object({
      brandId:
        brandAuthorityObjectIdSchema,

      claimType:
        z.enum(
          BRAND_CLAIM_TYPES,
        ),

      requestedMarketCodes:
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

      evidenceCheckIds:
        z
          .array(
            brandAuthorityObjectIdSchema,
          )
          .min(
            1,
            'At least one identity evidence check is required.',
          )
          .max(
            20,
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

      statement:
        z
          .string()
          .trim()
          .max(
            4000,
          )
          .optional()
          .default(
            '',
          ),
    })
    .strict()

export const listBrandClaimsQuerySchema =
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

      brandId:
        brandAuthorityObjectIdSchema
          .optional(),

      status:
        z
          .enum([
            'all',
            ...BRAND_CLAIM_STATUSES,
          ])
          .default(
            'all',
          ),
    })
    .strict()

export const brandClaimIdParamsSchema =
  z
    .object({
      id:
        brandAuthorityObjectIdSchema,
    })
    .strict()