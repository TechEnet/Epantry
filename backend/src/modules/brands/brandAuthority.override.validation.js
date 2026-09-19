import {
  z,
} from 'zod'

import {
  BRAND_OVERRIDE_FIELD_KEYS,
  normalizeBrandMarketCode,
} from './brandAuthority.constants.js'

const objectIdPattern =
  /^[a-fA-F0-9]{24}$/

export const brandOverrideObjectIdSchema =
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

const evidenceIdsSchema =
  z
    .array(
      brandOverrideObjectIdSchema,
    )
    .max(
      20,
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
    )

const fieldChangeSchema =
  z
    .object({
      fieldKey:
        z.enum(
          BRAND_OVERRIDE_FIELD_KEYS,
        ),

      proposedValue:
        z.unknown(),

      evidenceCheckIds:
        evidenceIdsSchema,

      changeReason:
        z
          .string()
          .trim()
          .min(
            3,
          )
          .max(
            3000,
          ),
    })
    .strict()

export const createContentOverrideProposalSchema =
  z
    .object({
      authorityGrantId:
        brandOverrideObjectIdSchema,

      productFamilyId:
        brandOverrideObjectIdSchema,

      productVariantId:
        brandOverrideObjectIdSchema,

      packId:
        brandOverrideObjectIdSchema,

      baseProductVersionId:
        brandOverrideObjectIdSchema,

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

      fieldChanges:
        z
          .array(
            fieldChangeSchema,
          )
          .min(
            1,
          )
          .max(
            50,
          )
          .superRefine(
            (
              values,
              context,
            ) => {
              const keys =
                values.map(
                  (
                    change,
                  ) =>
                    change.fieldKey,
                )

              if (
                new Set(
                  keys,
                ).size !==
                keys.length
              ) {
                context.addIssue({
                  code:
                    z.ZodIssueCode.custom,

                  message:
                    'Each canonical field may appear only once in a proposal.',
                })
              }
            },
          ),

      requestedEffectiveFrom:
        z
          .string()
          .datetime({
            offset:
              true,
          })
          .optional()
          .nullable(),
    })
    .strict()

export const contentOverrideProposalIdParamsSchema =
  z
    .object({
      id:
        brandOverrideObjectIdSchema,
    })
    .strict()

export const listContentOverrideProposalsQuerySchema =
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
            'draft',
            'submitted',
            'in_review',
            'approved',
            'rejected',
            'conflict',
            'activated',
            'withdrawn',
          ])
          .default(
            'all',
          ),

      brandId:
        brandOverrideObjectIdSchema
          .optional(),

      packId:
        brandOverrideObjectIdSchema
          .optional(),
    })
    .strict()

export const reviewContentOverrideProposalSchema =
  z
    .object({
      decision:
        z.enum([
          'approve',
          'reject',
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

export const contentConflictCaseIdParamsSchema =
  z
    .object({
      id:
        brandOverrideObjectIdSchema,
    })
    .strict()

export const resolveContentConflictSchema =
  z
    .object({
      resolution:
        z.enum([
          'approve_proposal',
          'reject_proposal',
          'quarantine',
        ]),

      selectedProposalId:
        brandOverrideObjectIdSchema
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
          value.resolution ===
            'approve_proposal' &&
          !value.selectedProposalId
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'selectedProposalId',
            ],

            message:
              'selectedProposalId is required when approving a proposal from conflict review.',
          })
        }
      },
    )