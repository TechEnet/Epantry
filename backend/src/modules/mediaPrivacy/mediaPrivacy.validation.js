import { z } from 'zod'

import {
  MEDIA_PRIVACY_METADATA_STATUSES,
  MEDIA_PRIVACY_RISK_SEVERITIES,
  MEDIA_PRIVACY_RISK_TYPES,
  MEDIA_REDACTION_OPERATION_TYPES,
} from './mediaPrivacy.models.js'

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'A valid MongoDB ObjectId is required.')

const reasonCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[A-Z0-9_]+$/, 'Reason code must use uppercase letters, numbers and underscores.')

const optionalReasonCodeSchema = z.union([reasonCodeSchema, z.literal('')])

const optionalEvidenceFingerprintSchema = z.union([
  z.string().trim().regex(/^[a-f\d]{64}$/i),
  z.literal(''),
])

const normalizedBoundingBoxSchema = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().positive().max(1),
    height: z.number().finite().positive().max(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.x + value.width > 1.000001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['width'],
        message: 'Bounding box exceeds normalized image width.',
      })
    }

    if (value.y + value.height > 1.000001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['height'],
        message: 'Bounding box exceeds normalized image height.',
      })
    }
  })

export const mediaPrivacyFindingSchema = z
  .object({
    riskType: z.enum(MEDIA_PRIVACY_RISK_TYPES),
    severity: z.enum(MEDIA_PRIVACY_RISK_SEVERITIES),
    confidence: z.number().finite().min(0).max(1),
    boundingBox: normalizedBoundingBoxSchema.nullable().optional().default(null),
    reasonCode: reasonCodeSchema,
    evidenceFingerprint: optionalEvidenceFingerprintSchema.optional().default(''),
  })
  .strict()

export const mediaPrivacyDetectorResultSchema = z
  .object({
    provider: z.string().trim().min(1).max(100),
    model: z.string().trim().max(160).optional().default(''),
    status: z.enum(['completed', 'unavailable', 'failed']),
    scannerVersion: z.string().trim().min(1).max(80),
    findings: z.array(mediaPrivacyFindingSchema).max(100).optional().default([]),
    failureCode: optionalReasonCodeSchema.optional().default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === 'completed' && value.failureCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failureCode'],
        message: 'Completed detector result cannot include a failure code.',
      })
    }

    if (value.status !== 'completed' && value.findings.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['findings'],
        message: 'Unavailable or failed detector result cannot claim completed findings.',
      })
    }
  })

export const mediaPrivacyMetadataResultSchema = z
  .object({
    status: z.enum(MEDIA_PRIVACY_METADATA_STATUSES),
    stripped: z.boolean(),
    removedKeys: z
      .array(z.string().trim().min(1).max(80))
      .max(50)
      .optional()
      .default([]),
    failureCode: optionalReasonCodeSchema.optional().default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === 'completed' && !value.stripped) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stripped'],
        message: 'Completed metadata sanitation must confirm stripped metadata.',
      })
    }

    if (value.status === 'failed' && !value.failureCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failureCode'],
        message: 'Failed metadata sanitation requires a failure code.',
      })
    }
  })

export const mediaPrivacyAssessmentInputSchema = z
  .object({
    imageEvidenceId: objectIdSchema,
    organizationId: objectIdSchema.nullable().optional().default(null),
    detectorResult: mediaPrivacyDetectorResultSchema,
    metadataResult: mediaPrivacyMetadataResultSchema,
    requestId: z.string().trim().max(160).optional().default(''),
    correlationId: z.string().trim().max(180).optional().default(''),
  })
  .strict()

export const mediaRedactionOperationSchema = z
  .object({
    operationType: z.enum(MEDIA_REDACTION_OPERATION_TYPES),
    boundingBox: normalizedBoundingBoxSchema.nullable().optional().default(null),
    reasonCode: reasonCodeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.operationType !== 'crop' && !value.boundingBox) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['boundingBox'],
        message: 'Blur and solid-mask operations require a bounding box.',
      })
    }
  })

export const createMediaRedactionJobInputSchema = z
  .object({
    imageEvidenceId: objectIdSchema,
    assessmentId: objectIdSchema,
    organizationId: objectIdSchema.nullable().optional().default(null),
    operations: z.array(mediaRedactionOperationSchema).min(1).max(50),
    originalRetainUntil: z.coerce.date(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.originalRetainUntil.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['originalRetainUntil'],
        message: 'Original retention boundary must be in the future.',
      })
    }
  })

export const completeMediaRedactionJobInputSchema = z
  .object({
    redactionJobId: objectIdSchema,
    outputImageEvidenceId: objectIdSchema,
  })
  .strict()

export const failMediaRedactionJobInputSchema = z
  .object({
    redactionJobId: objectIdSchema,
    failureCode: reasonCodeSchema,
  })
  .strict()

export const mediaRetentionRequestSchema = z
  .object({
    imageEvidenceId: objectIdSchema,
    organizationId: objectIdSchema.nullable().optional().default(null),
    action: z.enum([
      'cleanup_requested',
      'delete_original',
      'delete_redacted_copy',
      'retain_until',
    ]),
    reasonCode: reasonCodeSchema,
    policyKey: z.string().trim().toLowerCase().max(120).optional().default(''),
    policyVersion: z.number().int().positive().nullable().optional().default(null),
    retainUntil: z.coerce.date().nullable().optional().default(null),
    requestId: z.string().trim().max(160).optional().default(''),
    correlationId: z.string().trim().max(180).optional().default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === 'retain_until' && !value.retainUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['retainUntil'],
        message: 'retain_until action requires an explicit retention date.',
      })
    }
  })

export function parseMediaPrivacyAssessmentInput(value) {
  return mediaPrivacyAssessmentInputSchema.parse(value)
}

export function parseCreateMediaRedactionJobInput(value) {
  return createMediaRedactionJobInputSchema.parse(value)
}

export function parseCompleteMediaRedactionJobInput(value) {
  return completeMediaRedactionJobInputSchema.parse(value)
}

export function parseFailMediaRedactionJobInput(value) {
  return failMediaRedactionJobInputSchema.parse(value)
}

export function parseMediaRetentionRequest(value) {
  return mediaRetentionRequestSchema.parse(value)
}
