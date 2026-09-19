import {
  z,
} from 'zod'

const entityReferenceSchema = z
  .object({
    entityType:
      z
        .string()
        .trim()
        .min(1)
        .max(80),

    entityId:
      z
        .string()
        .trim()
        .min(1)
        .max(160),

    version:
      z
        .string()
        .trim()
        .max(80)
        .optional()
        .default(''),
  })
  .strict()

const featureFlagContextSchema = z
  .object({
    key:
      z
        .string()
        .trim()
        .min(1)
        .max(120),

    value:
      z
        .string()
        .trim()
        .min(1)
        .max(120),
  })
  .strict()

const experimentContextSchema = z
  .object({
    experimentKey:
      z
        .string()
        .trim()
        .min(1)
        .max(120),

    variantKey:
      z
        .string()
        .trim()
        .min(1)
        .max(120),
  })
  .strict()

export const analyticsEventBodySchema = z
  .object({
    clientEventId:
      z
        .string()
        .trim()
        .min(8)
        .max(160)
        .optional()
        .nullable()
        .default(null),

    eventName:
      z
        .string()
        .trim()
        .min(3)
        .max(160),

    eventVersion:
      z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(1),

    occurredAt:
      z.coerce
        .date()
        .optional()
        .default(
          () => new Date(),
        ),

    correlationId:
      z
        .string()
        .trim()
        .min(8)
        .max(180)
        .optional()
        .default(''),

    sessionId:
      z
        .string()
        .trim()
        .max(180)
        .optional()
        .default(''),

    householdId:
      z
        .string()
        .trim()
        .max(160)
        .optional()
        .default(''),

    entities:
      z
        .array(
          entityReferenceSchema,
        )
        .max(20)
        .default([]),

    sourceDomain:
      z
        .string()
        .trim()
        .min(2)
        .max(80),

    sourceVersion:
      z
        .string()
        .trim()
        .max(80)
        .optional()
        .default(''),

    decisionContext:
      z
        .enum([
          'organic',
          'sponsored',
          'mixed',
          'not_applicable',
        ])
        .default(
          'not_applicable',
        ),

    confidenceTier:
      z
        .enum([
          'verified',
          'high',
          'medium',
          'low',
          'unknown',
          'not_applicable',
        ])
        .default(
          'not_applicable',
        ),

    featureFlags:
      z
        .array(
          featureFlagContextSchema,
        )
        .max(30)
        .default([]),

    experiments:
      z
        .array(
          experimentContextSchema,
        )
        .max(20)
        .default([]),

    payload:
      z
        .record(
          z.string(),
          z.unknown(),
        )
        .default({}),
  })
  .strict()