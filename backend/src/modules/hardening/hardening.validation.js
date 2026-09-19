import {
  z,
} from 'zod'

const evidenceRefSchema = z
  .object({
    referenceType:
      z
        .string()
        .trim()
        .min(2)
        .max(80),

    reference:
      z
        .string()
        .trim()
        .min(2)
        .max(500),

    note:
      z
        .string()
        .trim()
        .max(500)
        .optional()
        .default(''),
  })
  .strict()

const objectIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-f\d]{24}$/i,
    'A valid MongoDB ObjectId is required.',
  )

export const privacyRequestParamsSchema = z
  .object({
    id:
      objectIdSchema,
  })
  .strict()

export const privacyRequestBodySchema = z
  .object({
    requestType:
      z.enum([
        'access_export',
        'deletion',
      ]),

    scope:
      z
        .string()
        .trim()
        .min(2)
        .max(120)
        .default('account'),
  })
  .strict()

export const retentionPolicyBodySchema = z
  .object({
    policyKey:
      z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(120)
        .regex(/^[a-z0-9_.-]+$/),

    dataClass:
      z
        .string()
        .trim()
        .toLowerCase()
        .min(2)
        .max(120)
        .regex(/^[a-z0-9_.-]+$/),

    purpose:
      z
        .string()
        .trim()
        .min(10)
        .max(500),

    retentionDays:
      z
        .number()
        .int()
        .min(0)
        .max(36500)
        .nullable()
        .default(null),

    dispositionAction:
      z.enum([
        'delete',
        'anonymize',
        'restrict',
        'retain',
      ]),

    immutableRecordClass:
      z
        .boolean()
        .default(false),

    applicability:
      z
        .array(
          z
            .string()
            .trim()
            .min(2)
            .max(120),
        )
        .max(40)
        .default([]),

    effectiveFrom:
      z.coerce.date(),

    effectiveTo:
      z.coerce
        .date()
        .nullable()
        .default(null),

    evidenceRefs:
      z
        .array(
          evidenceRefSchema,
        )
        .min(1)
        .max(40),

    reason:
      z
        .string()
        .trim()
        .min(10)
        .max(1500),
  })
  .strict()
  .superRefine(
    (
      value,
      context,
    ) => {
      if (
        value.effectiveTo &&
        value.effectiveTo <=
          value.effectiveFrom
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: [
            'effectiveTo',
          ],
          message:
            'effectiveTo must be after effectiveFrom.',
        })
      }

      if (
        value.dispositionAction ===
          'retain' &&
        value.retentionDays !==
          null
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: [
            'retentionDays',
          ],
          message:
            'Permanent/required retention must not claim an automatic deletion day.',
        })
      }
    },
  )

export const lifecycleParamsSchema = z
  .object({
    id:
      objectIdSchema,

    action:
      z.enum([
        'submit',
        'approve',
        'activate',
      ]),
  })
  .strict()

export const lifecycleBodySchema = z
  .object({
    reason:
      z
        .string()
        .trim()
        .min(10)
        .max(1500),
  })
  .strict()

export const regulatoryProfileBodySchema = z
  .object({
    profileKey:
      z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(120)
        .regex(/^[a-z0-9_.-]+$/),

    jurisdiction:
      z
        .string()
        .trim()
        .toUpperCase()
        .min(2)
        .max(40),

    operatorApplicability:
      z
        .array(
          z.enum([
            'consumer_service',
            'marketplace_operator',
            'brand_content_operator',
            'hospitality_operator',
            'platform_operator',
          ]),
        )
        .min(1)
        .max(5),

    effectiveFrom:
      z.coerce.date(),

    effectiveTo:
      z.coerce
        .date()
        .nullable()
        .default(null),

    requiredFields:
      z
        .array(
          z
            .string()
            .trim()
            .min(1)
            .max(160),
        )
        .max(100)
        .default([]),

    calculationMethodologyVersion:
      z
        .string()
        .trim()
        .min(1)
        .max(120),

    presentationRules:
      z
        .record(
          z.string(),
          z.unknown(),
        )
        .default({}),

    evidenceRefs:
      z
        .array(
          evidenceRefSchema,
        )
        .min(1)
        .max(50),

    reason:
      z
        .string()
        .trim()
        .min(10)
        .max(1500),
  })
  .strict()
  .superRefine(
    (
      value,
      context,
    ) => {
      if (
        value.effectiveTo &&
        value.effectiveTo <=
          value.effectiveFrom
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: [
            'effectiveTo',
          ],
          message:
            'effectiveTo must be after effectiveFrom.',
        })
      }
    },
  )