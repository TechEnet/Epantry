import {
  z,
} from 'zod'

import {
  ADMIN_FEATURE_FLAG_ENVIRONMENTS,
  ADMIN_GOVERNANCE_DOMAINS,
  ADMIN_GOVERNANCE_PRIORITIES,
  ADMIN_GOVERNANCE_SEVERITIES,
  ADMIN_INCIDENT_STATUSES,
  ADMIN_REVIEW_CASE_STATUSES,
  ADMIN_REVIEW_CASE_TYPES,
  ADMIN_SUPPORT_CASE_STATUSES,
} from './adminGovernance.models.js'

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const evidenceSchema =
  z
    .object({
      type:
        z.enum([
          'source',
          'document',
          'audit_event',
          'incident',
          'ticket',
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

      checksumSha256:
        z
          .union([
            z
              .string()
              .trim()
              .regex(/^[a-f\d]{64}$/i),

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

const evidenceArraySchema =
  z
    .array(
      evidenceSchema,
    )
    .max(30)
    .default([])

const entitySchema =
  z
    .object({
      type:
        z
          .string()
          .trim()
          .min(2)
          .max(120)
          .regex(/^[a-zA-Z][a-zA-Z0-9_.:-]*$/),

      id:
        z
          .string()
          .trim()
          .min(1)
          .max(200),

      label:
        z
          .string()
          .trim()
          .max(300)
          .optional()
          .default(''),
    })
    .strict()

export const adminGovernanceIdParamsSchema =
  z
    .object({
      id:
        objectIdSchema,
    })
    .strict()

export const adminGovernanceSearchQuerySchema =
  z
    .object({
      q:
        z
          .string()
          .trim()
          .min(2)
          .max(80),

      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(50)
          .default(25),

      types:
        z
          .preprocess(
            (value) => {
              if (
                value ===
                  undefined ||
                value ===
                  null ||
                value ===
                  ''
              ) {
                return undefined
              }

              if (
                Array.isArray(value)
              ) {
                return value
              }

              return String(value)
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            },
            z
              .array(
                z.enum([
                  'user',
                  'organization',
                  'brand',
                  'ingredient',
                  'product_version',
                  'dish',
                  'recipe_version',
                  'seller_order',
                  'settlement',
                  'review_case',
                  'incident',
                  'support_case',
                  'audit_event',
                ]),
              )
              .max(13)
              .optional(),
          )
          .optional(),
    })
    .strict()

export const listReviewCasesQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25),

      domain:
        z
          .enum(
            ADMIN_GOVERNANCE_DOMAINS,
          )
          .optional(),

      status:
        z
          .enum(
            ADMIN_REVIEW_CASE_STATUSES,
          )
          .optional(),

      severity:
        z
          .enum(
            ADMIN_GOVERNANCE_SEVERITIES,
          )
          .optional(),

      priority:
        z
          .enum(
            ADMIN_GOVERNANCE_PRIORITIES,
          )
          .optional(),

      assignedToUserId:
        objectIdSchema
          .optional(),
    })
    .strict()

export const createReviewCaseBodySchema =
  z
    .object({
      domain:
        z.enum(
          ADMIN_GOVERNANCE_DOMAINS,
        ),

      caseType:
        z.enum(
          ADMIN_REVIEW_CASE_TYPES,
        ),

      entity:
        entitySchema,

      severity:
        z
          .enum(
            ADMIN_GOVERNANCE_SEVERITIES,
          )
          .default('medium'),

      priority:
        z
          .enum(
            ADMIN_GOVERNANCE_PRIORITIES,
          )
          .default('p2'),

      summary:
        z
          .string()
          .trim()
          .min(5)
          .max(500),

      details:
        z
          .string()
          .trim()
          .max(5000)
          .optional()
          .default(''),

      evidence:
        evidenceArraySchema,
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.severity ===
            'critical' &&
          value.evidence.length ===
            0
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'evidence',
            ],

            message:
              'Critical review cases require source/evidence.',
          })
        }
      },
    )

export const assignReviewCaseBodySchema =
  z
    .object({
      assignedToUserId:
        objectIdSchema
          .nullable(),

      reason:
        z
          .string()
          .trim()
          .min(3)
          .max(2000),
    })
    .strict()

export const decideReviewCaseBodySchema =
  z
    .object({
      decision:
        z.enum([
          'accept',
          'reject',
          'needs_action',
          'resolve',
          'dismiss',
        ]),

      reason:
        z
          .string()
          .trim()
          .min(5)
          .max(4000),

      evidence:
        evidenceArraySchema,
    })
    .strict()

export const listIncidentsQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25),

      domain:
        z
          .enum(
            ADMIN_GOVERNANCE_DOMAINS,
          )
          .optional(),

      status:
        z
          .enum(
            ADMIN_INCIDENT_STATUSES,
          )
          .optional(),

      severity:
        z
          .enum(
            ADMIN_GOVERNANCE_SEVERITIES,
          )
          .optional(),
    })
    .strict()

export const createIncidentBodySchema =
  z
    .object({
      domain:
        z.enum(
          ADMIN_GOVERNANCE_DOMAINS,
        ),

      title:
        z
          .string()
          .trim()
          .min(5)
          .max(300),

      summary:
        z
          .string()
          .trim()
          .min(10)
          .max(5000),

      severity:
        z
          .enum(
            ADMIN_GOVERNANCE_SEVERITIES,
          )
          .default('high'),

      impactedSurfaces:
        z
          .array(
            z
              .string()
              .trim()
              .min(2)
              .max(120),
          )
          .max(30)
          .default([]),

      evidence:
        evidenceArraySchema,

      bannerEnabled:
        z
          .boolean()
          .default(false),

      bannerMessage:
        z
          .string()
          .trim()
          .max(1000)
          .optional()
          .default(''),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.severity ===
            'critical' &&
          value.evidence.length ===
            0
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'evidence',
            ],

            message:
              'Critical incidents require source/evidence.',
          })
        }

        if (
          value.bannerEnabled &&
          !value.bannerMessage
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'bannerMessage',
            ],

            message:
              'An enabled incident banner requires a message.',
          })
        }
      },
    )

export const updateIncidentBodySchema =
  z
    .object({
      status:
        z
          .enum(
            ADMIN_INCIDENT_STATUSES,
          )
          .optional(),

      assignedToUserId:
        objectIdSchema
          .nullable()
          .optional(),

      bannerEnabled:
        z
          .boolean()
          .optional(),

      bannerMessage:
        z
          .string()
          .trim()
          .max(1000)
          .optional(),

      reason:
        z
          .string()
          .trim()
          .min(3)
          .max(4000),

      evidence:
        evidenceArraySchema,
    })
    .strict()

export const listSupportCasesQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25),

      domain:
        z
          .enum(
            ADMIN_GOVERNANCE_DOMAINS,
          )
          .optional(),

      status:
        z
          .enum(
            ADMIN_SUPPORT_CASE_STATUSES,
          )
          .optional(),

      priority:
        z
          .enum(
            ADMIN_GOVERNANCE_PRIORITIES,
          )
          .optional(),
    })
    .strict()

export const createSupportCaseBodySchema =
  z
    .object({
      domain:
        z.enum(
          ADMIN_GOVERNANCE_DOMAINS,
        ),

      subject:
        z
          .object({
            type:
              z.enum([
                'user',
                'organization',
                'order',
                'product',
                'recipe',
                'integration',
                'other',
              ]),

            id:
              z
                .string()
                .trim()
                .min(1)
                .max(200),
          })
          .strict(),

      title:
        z
          .string()
          .trim()
          .min(5)
          .max(300),

      description:
        z
          .string()
          .trim()
          .min(10)
          .max(5000),

      priority:
        z
          .enum(
            ADMIN_GOVERNANCE_PRIORITIES,
          )
          .default('p2'),

      evidence:
        evidenceArraySchema,
    })
    .strict()

export const updateSupportCaseBodySchema =
  z
    .object({
      status:
        z
          .enum(
            ADMIN_SUPPORT_CASE_STATUSES,
          )
          .optional(),

      assignedToUserId:
        objectIdSchema
          .nullable()
          .optional(),

      reason:
        z
          .string()
          .trim()
          .min(3)
          .max(4000),

      evidence:
        evidenceArraySchema,
    })
    .strict()

export const listFeatureFlagsQuerySchema =
  z
    .object({
      environment:
        z
          .enum(
            ADMIN_FEATURE_FLAG_ENVIRONMENTS,
          )
          .optional(),

      enabled:
        z
          .preprocess(
            (value) => {
              if (
                value ===
                  undefined ||
                value ===
                  null ||
                value ===
                  ''
              ) {
                return undefined
              }

              if (
                value ===
                  true ||
                value ===
                  'true'
              ) {
                return true
              }

              if (
                value ===
                  false ||
                value ===
                  'false'
              ) {
                return false
              }

              return value
            },
            z.boolean().optional(),
          )
          .optional(),
    })
    .strict()

export const createFeatureFlagBodySchema =
  z
    .object({
      key:
        z
          .string()
          .trim()
          .toLowerCase()
          .min(3)
          .max(100)
          .regex(/^[a-z][a-z0-9_.-]*$/),

      description:
        z
          .string()
          .trim()
          .min(5)
          .max(1500),

      enabled:
        z
          .boolean()
          .default(false),

      environments:
        z
          .array(
            z.enum(
              ADMIN_FEATURE_FLAG_ENVIRONMENTS,
            ),
          )
          .min(1)
          .max(3),

      rolloutPercentage:
        z
          .number()
          .min(0)
          .max(100)
          .default(0),

      ownerDomain:
        z
          .enum(
            ADMIN_GOVERNANCE_DOMAINS,
          )
          .default('admin'),

      riskLevel:
        z
          .enum([
            'low',
            'medium',
            'high',
            'critical',
          ])
          .default('medium'),

      expiresAt:
        z.coerce
          .date()
          .nullable()
          .optional()
          .default(null),

      reason:
        z
          .string()
          .trim()
          .min(10)
          .max(4000),

      evidence:
        evidenceArraySchema,
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        const highRisk =
          [
            'high',
            'critical',
          ].includes(
            value.riskLevel,
          ) ||
          (
            value.enabled &&
            value.environments.includes(
              'production',
            )
          )

        if (
          highRisk &&
          value.evidence.length ===
            0
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'evidence',
            ],

            message:
              'High-risk or production-enabled feature flags require evidence.',
          })
        }
      },
    )

export const updateFeatureFlagBodySchema =
  z
    .object({
      description:
        z
          .string()
          .trim()
          .min(5)
          .max(1500)
          .optional(),

      enabled:
        z
          .boolean()
          .optional(),

      environments:
        z
          .array(
            z.enum(
              ADMIN_FEATURE_FLAG_ENVIRONMENTS,
            ),
          )
          .min(1)
          .max(3)
          .optional(),

      rolloutPercentage:
        z
          .number()
          .min(0)
          .max(100)
          .optional(),

      ownerDomain:
        z
          .enum(
            ADMIN_GOVERNANCE_DOMAINS,
          )
          .optional(),

      riskLevel:
        z
          .enum([
            'low',
            'medium',
            'high',
            'critical',
          ])
          .optional(),

      expiresAt:
        z.coerce
          .date()
          .nullable()
          .optional(),

      reason:
        z
          .string()
          .trim()
          .min(10)
          .max(4000),

      evidence:
        evidenceArraySchema,
    })
    .strict()

export const executeGovernanceActionBodySchema =
  z
    .object({
      entityType:
        z.enum([
          'product_version',
          'recipe_version',
          'dish',
        ]),

      entityId:
        objectIdSchema,

      action:
        z.enum([
          'quarantine',
          'disable',
          'recover',
        ]),

      reviewCaseId:
        objectIdSchema
          .nullable()
          .optional()
          .default(null),

      summary:
        z
          .string()
          .trim()
          .max(500)
          .optional()
          .default(''),

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