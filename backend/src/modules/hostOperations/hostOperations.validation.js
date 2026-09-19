import {
  z,
} from 'zod'

import {
  createAdminRecipeSchema,
} from '../recipes/recipe.admin.validation.js'

import {
  HOST_KYB_STATUSES,
  HOST_ORG_MEMBER_STATUSES,
  HOST_ORG_PERMISSION_KEYS,
} from './hostOperations.models.js'

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const countryCodeSchema =
  z
    .string()
    .trim()
    .regex(
      /^[A-Za-z]{2}$/,
    )
    .transform(
      (
        value,
      ) =>
        value.toUpperCase(),
    )

const currencySchema =
  z
    .string()
    .trim()
    .length(
      3,
    )
    .transform(
      (
        value,
      ) =>
        value.toUpperCase(),
    )

const idempotencyKeySchema =
  z
    .string()
    .trim()
    .min(
      8,
    )
    .max(
      160,
    )

const optionalDateSchema =
  z.coerce
    .date()
    .nullable()
    .optional()
    .default(
      null,
    )

const addressSchema =
  z
    .object({
      line1:
        z
          .string()
          .trim()
          .max(
            240,
          )
          .optional()
          .default(
            '',
          ),

      line2:
        z
          .string()
          .trim()
          .max(
            240,
          )
          .optional()
          .default(
            '',
          ),

      city:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(
            '',
          ),

      state:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(
            '',
          ),

      postalCode:
        z
          .string()
          .trim()
          .max(
            24,
          )
          .optional()
          .default(
            '',
          ),

      countryCode:
        countryCodeSchema
          .optional()
          .default(
            'IN',
          ),
    })
    .strict()

export const createHostOrganizationSchema =
  z
    .object({
      displayName:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            220,
          ),

      organizationType:
        z
          .enum([
            'seller',
            'brand',
            'b2b',
            'hybrid',
          ])
          .default(
            'hybrid',
          ),
    })
    .strict()

export const hostCommercialProfileRequestSchema =
  z
    .object({
      organizationType:
        z.enum([
          'seller',
          'brand',
          'b2b',
          'hybrid',
        ]),

      note:
        z
          .string()
          .trim()
          .max(1200)
          .optional()
          .default(''),
    })
    .strict()

export const updateHostOperationalProfileSchema =
  z
    .object({
      legalEntityName:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            240,
          ),

      businessType:
        z.enum([
          'proprietorship',
          'partnership',
          'llp',
          'private_limited',
          'public_limited',
          'other',
        ]),

      jurisdictionCountryCode:
        countryCodeSchema
          .default(
            'IN',
          ),

      registeredAddress:
        addressSchema,

      supportEmail:
        z
          .union([
            z
              .string()
              .trim()
              .email()
              .max(
                254,
              ),

            z.literal(
              '',
            ),
          ])
          .optional()
          .default(
            '',
          ),

      supportPhone:
        z
          .string()
          .trim()
          .max(
            32,
          )
          .optional()
          .default(
            '',
          ),

      commercial:
        z
          .object({
            settlementCurrency:
              currencySchema
                .default(
                  'INR',
                ),

            fulfillmentTypes:
              z
                .array(
                  z.enum([
                    'delivery',
                    'pickup',
                  ]),
                )
                .max(
                  2,
                )
                .default(
                  [],
                ),

            cancellationPolicySummary:
              z
                .string()
                .trim()
                .max(
                  1200,
                )
                .optional()
                .default(
                  '',
                ),

            returnPolicySummary:
              z
                .string()
                .trim()
                .max(
                  1200,
                )
                .optional()
                .default(
                  '',
                ),
          })
          .strict(),
    })
    .strict()

export const hostMemberBodySchema =
  z
    .object({
      userId:
        objectIdSchema,

      roleLabel:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            120,
          )
          .default(
            'Staff',
          ),

      permissionKeys:
        z
          .array(
            z.enum(
              HOST_ORG_PERMISSION_KEYS,
            ),
          )
          .min(
            1,
          )
          .max(
            HOST_ORG_PERMISSION_KEYS.length,
          ),
    })
    .strict()

export const hostMemberUpdateSchema =
  z
    .object({
      status:
        z
          .enum(
            HOST_ORG_MEMBER_STATUSES,
          )
          .optional(),

      roleLabel:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            120,
          )
          .optional(),

      permissionKeys:
        z
          .array(
            z.enum(
              HOST_ORG_PERMISSION_KEYS,
            ),
          )
          .min(
            1,
          )
          .max(
            HOST_ORG_PERMISSION_KEYS.length,
          )
          .optional(),
    })
    .strict()
    .refine(
      (
        value,
      ) =>
        Object.keys(
          value,
        ).length >
        0,

      'At least one member field is required.',
    )

export const hostDocumentSchema =
  z
    .object({
      documentType:
        z.enum([
          'incorporation',
          'tax_registration',
          'food_license',
          'bank_proof',
          'authorization_letter',
          'identity',
          'address',
          'other',
        ]),

      label:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            220,
          ),

      providerKey:
        z
          .string()
          .trim()
          .max(
            80,
          )
          .optional()
          .default(
            '',
          ),

      providerAssetId:
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

      originalFileName:
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

      mimeType:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(
            '',
          ),

      bytes:
        z
          .number()
          .int()
          .min(
            0,
          )
          .max(
            25 *
              1024 *
              1024,
          )
          .optional()
          .default(
            0,
          ),

      checksumSha256:
        z
          .union([
            z
              .string()
              .trim()
              .regex(
                /^[a-f\d]{64}$/i,
              ),

            z.literal(
              '',
            ),
          ])
          .optional()
          .default(
            '',
          ),

      expiresAt:
        optionalDateSchema,
    })
    .strict()

export const upsertHostKybSchema =
  z
    .object({
      legalEntityName:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            240,
          ),

      businessType:
        z.enum([
          'proprietorship',
          'partnership',
          'llp',
          'private_limited',
          'public_limited',
          'other',
        ]),

      jurisdictionCountryCode:
        countryCodeSchema
          .default(
            'IN',
          ),

      taxRegistrationType:
        z
          .string()
          .trim()
          .max(
            40,
          )
          .optional()
          .default(
            '',
          ),

      taxRegistrationValue:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(
            '',
          ),

      documentIds:
        z
          .array(
            objectIdSchema,
          )
          .max(
            40,
          )
          .default(
            [],
          ),
    })
    .strict()

export const hostActivationRequestSchema =
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
            2000,
          )
          .default(
            'Ready for operational activation review.',
          ),
    })
    .strict()

export const adminKybDecisionSchema =
  z
    .object({
      decision:
        z.enum([
          'approved',
          'needs_information',
          'rejected',
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

export const adminActivationDecisionSchema =
  z
    .object({
      decision:
        z.enum([
          'activate',
          'reject',
          'suspend',
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

      testOrderReference:
        z
          .string()
          .trim()
          .max(
            240,
          )
          .optional()
          .default(
            '',
          ),
    })
    .strict()

const catalogRowSchema =
  z
    .object({
      merchantSku:
        z
          .string()
          .trim()
          .max(
            180,
          )
          .optional()
          .default(
            '',
          ),

      gtin:
        z
          .union([
            z
              .string()
              .trim()
              .regex(
                /^\d{8,14}$/,
              ),

            z.literal(
              '',
            ),
          ])
          .optional()
          .default(
            '',
          ),

      packId:
        objectIdSchema
          .nullable()
          .optional()
          .default(
            null,
          ),

      displayName:
        z
          .string()
          .trim()
          .max(
            350,
          )
          .optional()
          .default(
            '',
          ),

      brandName:
        z
          .string()
          .trim()
          .max(
            180,
          )
          .optional()
          .default(
            '',
          ),

      netQuantityText:
        z
          .string()
          .trim()
          .max(
            120,
          )
          .optional()
          .default(
            '',
          ),

      priceMinor:
        z
          .number()
          .int()
          .min(
            0,
          )
          .nullable()
          .optional()
          .default(
            null,
          ),

      inventoryQuantity:
        z
          .number()
          .min(
            0,
          )
          .nullable()
          .optional()
          .default(
            null,
          ),
    })
    .strict()
    .refine(
      (
        value,
      ) =>
        Boolean(
          value.gtin ||
          value.packId ||
          value.merchantSku ||
          value.displayName,
        ),

      'Each import row requires at least one identity or merchant field.',
    )

export const createCatalogIngestJobSchema =
  z
    .object({
      sourceType:
        z
          .enum([
            'manual_bulk',
            'csv_normalized',
            'erp',
            'external_api',
          ])
          .default(
            'manual_bulk',
          ),

      rows:
        z
          .array(
            catalogRowSchema,
          )
          .min(
            1,
          )
          .max(
            500,
          ),
    })
    .strict()

export const listHostCatalogImportsQuerySchema =
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
            50,
          )
          .default(
            20,
          ),
    })
    .strict()

export const listBrandRecipeSubmissionsQuerySchema =
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
            50,
          )
          .default(
            20,
          ),

      status:
        z
          .enum([
            'submitted',
            'accepted_for_governance',
            'changes_requested',
            'rejected',
          ])
          .optional(),
    })
    .strict()

export const createBrandRecipeSubmissionSchema =
  z
    .object({
      brandId:
        objectIdSchema,

      authorityGrantId:
        objectIdSchema,

      marketCode:
        countryCodeSchema
          .default(
            'IN',
          ),

      nominationDisclosure:
        z
          .string()
          .trim()
          .min(
            10,
          )
          .max(
            2000,
          ),

      nominatedProductPackIds:
        z
          .array(
            objectIdSchema,
          )
          .max(
            30,
          )
          .default(
            [],
          ),

      recipe:
        createAdminRecipeSchema,
    })
    .strict()

export const adminBrandRecipeDecisionSchema =
  z
    .object({
      decision:
        z.enum([
          'accept_for_governance',
          'request_changes',
          'reject',
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

export const createCampaignBriefSchema =
  z
    .object({
      brandId:
        objectIdSchema
          .nullable()
          .optional()
          .default(
            null,
          ),

      authorityGrantId:
        objectIdSchema
          .nullable()
          .optional()
          .default(
            null,
          ),

      title:
        z
          .string()
          .trim()
          .min(
            2,
          )
          .max(
            220,
          ),

      objective:
        z.enum([
          'awareness',
          'consideration',
          'conversion',
          'sampling',
          'promotion',
        ]),

      marketCodes:
        z
          .array(
            countryCodeSchema,
          )
          .min(
            1,
          )
          .max(
            20,
          )
          .default([
            'IN',
          ]),

      requestedPlacements:
        z
          .array(
            z
              .string()
              .trim()
              .min(
                2,
              )
              .max(
                120,
              ),
          )
          .max(
            30,
          )
          .default(
            [],
          ),

      startsAt:
        optionalDateSchema,

      endsAt:
        optionalDateSchema,

      budgetAmountMinor:
        z
          .number()
          .int()
          .min(
            0,
          )
          .default(
            0,
          ),

      currency:
        currencySchema
          .default(
            'INR',
          ),

      promotedEntityType:
        z
          .enum([
            'product',
            'brand',
            'recipe',
            'generic',
          ])
          .default(
            'generic',
          ),

      promotedEntityId:
        z
          .string()
          .trim()
          .max(
            240,
          )
          .optional()
          .default(
            '',
          ),

      commercialDisclosure:
        z
          .string()
          .trim()
          .min(
            5,
          )
          .max(
            2000,
          ),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          Boolean(
            value.brandId,
          ) !==
          Boolean(
            value.authorityGrantId,
          )
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'authorityGrantId',
            ],

            message:
              'brandId and authorityGrantId must be provided together.',
          })
        }

        if (
          value.startsAt &&
          value.endsAt &&
          value.endsAt <=
            value.startsAt
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'endsAt',
            ],

            message:
              'Campaign end must be after campaign start.',
          })
        }
      },
    )

export const campaignSubmitSchema =
  z
    .object({
      acknowledgment:
        z.literal(
          true,
        ),
    })
    .strict()

export const objectIdParamsSchema =
  z
    .object({
      id:
        objectIdSchema,
    })
    .strict()

export const organizationIdParamsSchema =
  z
    .object({
      organizationId:
        objectIdSchema,
    })
    .strict()

export const memberIdParamsSchema =
  z
    .object({
      memberId:
        objectIdSchema,
    })
    .strict()

export const idempotencyHeaderSchema =
  idempotencyKeySchema

export const adminKybQueueQuerySchema =
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
          .enum(
            HOST_KYB_STATUSES,
          )
          .optional(),
    })
    .strict()