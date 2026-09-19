import {
  z,
} from 'zod'

import {
  HOSPITALITY_CHANGE_DOMAINS,
  HOSPITALITY_CHANGE_SOURCE_TYPES,
} from './hospitality.passport.models.js'

const objectIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-f\d]{24}$/i,
    'A valid MongoDB ObjectId is required.',
  )

const evidenceSchema = z
  .object({
    type:
      z.enum([
        'source',
        'document',
        'ticket',
        'audit_event',
        'external_reference',
        'other',
      ]),

    label:
      z
        .string()
        .trim()
        .min(2)
        .max(240),

    referenceId:
      z
        .string()
        .trim()
        .max(300)
        .optional()
        .default(''),

    uri:
      z
        .union([
          z
            .string()
            .trim()
            .url()
            .max(1500),
          z.literal(''),
        ])
        .optional()
        .default(''),

    note:
      z
        .string()
        .trim()
        .max(1500)
        .optional()
        .default(''),
  })
  .strict()

export const hospitalityPassportIdParamsSchema = z
  .object({
    id:
      objectIdSchema,
  })
  .strict()

export const publicPassportParamsSchema = z
  .object({
    publicId:
      z
        .string()
        .trim()
        .min(8)
        .max(80)
        .regex(
          /^dp_[a-f0-9]+$/,
          'Invalid Dish Passport public ID.',
        ),
  })
  .strict()

export const generateDishPassportBodySchema = z
  .object({
    outletId:
      objectIdSchema,

    productionRecipeVersionId:
      objectIdSchema,

    changeCaseId:
      objectIdSchema
        .nullable()
        .optional()
        .default(null),
  })
  .strict()

export const passportDecisionBodySchema = z
  .object({
    reason:
      z
        .string()
        .trim()
        .min(10)
        .max(4000),

    evidence:
      z
        .array(
          evidenceSchema,
        )
        .min(1)
        .max(30),
  })
  .strict()

export const generateGreyBookBodySchema = z
  .object({
    outletId:
      objectIdSchema,

    effectiveAt:
      z.coerce
        .date()
        .optional()
        .default(
          () => new Date(),
        ),

    changeCaseId:
      objectIdSchema
        .nullable()
        .optional()
        .default(null),
  })
  .strict()

export const greyBookExportQuerySchema = z
  .object({
    format:
      z
        .enum([
          'json',
          'csv',
        ])
        .default('json'),
  })
  .strict()

export const detectHospitalityChangeBodySchema = z
  .object({
    sourceType:
      z.enum(
        HOSPITALITY_CHANGE_SOURCE_TYPES,
      ),

    sourceId:
      objectIdSchema,

    sourceVersion:
      z
        .string()
        .trim()
        .max(160)
        .optional()
        .default(''),

    changedDomains:
      z
        .array(
          z.enum(
            HOSPITALITY_CHANGE_DOMAINS,
          ),
        )
        .min(1)
        .max(
          HOSPITALITY_CHANGE_DOMAINS.length,
        ),

    reason:
      z
        .string()
        .trim()
        .min(10)
        .max(4000),

    evidence:
      z
        .array(
          evidenceSchema,
        )
        .min(1)
        .max(30),
  })
  .strict()

export const changeCaseActionBodySchema = z
  .object({
    reason:
      z
        .string()
        .trim()
        .min(10)
        .max(4000),

    evidence:
      z
        .array(
          evidenceSchema,
        )
        .min(1)
        .max(30),
  })
  .strict()

export const changeCaseDecisionBodySchema = z
  .object({
    decision:
      z.enum([
        'approve',
        'dismiss',
      ]),

    reason:
      z
        .string()
        .trim()
        .min(10)
        .max(4000),

    evidence:
      z
        .array(
          evidenceSchema,
        )
        .min(1)
        .max(30),
  })
  .strict()