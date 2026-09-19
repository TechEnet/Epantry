import { z } from 'zod'

import { ApiError } from '../../utils/ApiError.js'
import { ApiResponse } from '../../utils/ApiResponse.js'

import {
  requireActiveHostMarketplaceOrganization,
} from '../marketplace/marketplace.host.service.js'

import {
  MEDIA_PRIVACY_DEFAULT_ORIGINAL_RETENTION_DAYS,
  createMediaRedactionJob,
  getLatestMediaPrivacyState,
  getPrivacyReviewCaseForAdmin,
  listPrivacyReviewCasesForAdmin,
  recordMediaRetentionAction,
  resolvePrivacyReviewCaseForAdmin,
} from './mediaPrivacy.service.js'

import {
  recheckOwnedImageEvidencePrivacy,
} from './mediaPrivacy.scanner.service.js'

import {
  mediaRedactionOperationSchema,
} from './mediaPrivacy.validation.js'

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'A valid MongoDB ObjectId is required.')

const evidenceParamsSchema = z.object({
  imageEvidenceId: objectIdSchema,
}).strict()

const reviewCaseParamsSchema = z.object({
  privacyReviewCaseId: objectIdSchema,
}).strict()

const redactionBodySchema = z.object({
  assessmentId: objectIdSchema,
  operations: z.array(mediaRedactionOperationSchema).min(1).max(50),
}).strict()

const reviewQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['all', 'open', 'in_review', 'resolved', 'cancelled'])
    .optional()
    .default('open'),
}).strict()

const reviewResolutionSchema = z.object({
  decision: z.enum([
    'safe_to_use',
    'redaction_required',
    'reupload_required',
    'delete_media',
  ]),
  resolutionNote: z.string().trim().min(3).max(1000),
}).strict()

function actorUserId(req) {
  return req.currentUser?._id || req.currentUser?.id
}

function parse(schema, value, code) {
  const result = schema.safeParse(value)

  if (!result.success) {
    throw new ApiError(400, 'Invalid media privacy request.', [
      {
        code,
        issues: result.error.issues,
      },
    ])
  }

  return result.data
}

function send(req, res, statusCode, data, message) {
  return res.status(statusCode).json(
    new ApiResponse(
      statusCode,
      {
        ...data,
        requestId: req.requestId,
      },
      message,
    ),
  )
}

async function hostOrganizationId(req) {
  const organization = await requireActiveHostMarketplaceOrganization(
    req.currentUser,
  )

  return organization._id
}

function defaultRetentionBoundary() {
  const value = new Date()
  value.setUTCDate(
    value.getUTCDate() + MEDIA_PRIVACY_DEFAULT_ORIGINAL_RETENTION_DAYS,
  )
  return value
}

async function stateForScope(req, res, organizationId = null) {
  const params = parse(
    evidenceParamsSchema,
    req.params,
    'MEDIA_PRIVACY_EVIDENCE_PARAMS_INVALID',
  )

  return send(
    req,
    res,
    200,
    await getLatestMediaPrivacyState({
      imageEvidenceId: params.imageEvidenceId,
      actorUserId: actorUserId(req),
      organizationId,
    }),
    'Media privacy state loaded.',
  )
}

async function recheckForScope(req, res, organizationId = null) {
  const params = parse(
    evidenceParamsSchema,
    req.params,
    'MEDIA_PRIVACY_EVIDENCE_PARAMS_INVALID',
  )

  return send(
    req,
    res,
    200,
    await recheckOwnedImageEvidencePrivacy({
      imageEvidenceId: params.imageEvidenceId,
      actorUserId: actorUserId(req),
      organizationId,
      requestId: req.requestId,
    }),
    'Media privacy recheck completed.',
  )
}

async function redactionForScope(req, res, organizationId = null) {
  const params = parse(
    evidenceParamsSchema,
    req.params,
    'MEDIA_PRIVACY_EVIDENCE_PARAMS_INVALID',
  )

  const body = parse(
    redactionBodySchema,
    req.body,
    'MEDIA_PRIVACY_REDACTION_INPUT_INVALID',
  )

  const redactionJob = await createMediaRedactionJob({
    input: {
      imageEvidenceId: params.imageEvidenceId,
      assessmentId: body.assessmentId,
      organizationId: organizationId ? String(organizationId) : null,
      operations: body.operations,
      originalRetainUntil: defaultRetentionBoundary(),
    },
    actorUserId: actorUserId(req),
  })

  return send(
    req,
    res,
    201,
    { redactionJob },
    'Privacy redaction job queued.',
  )
}

async function cleanupForScope(
  req,
  res,
  organizationId = null,
  reasonCode = 'CUSTOMER_PRIVACY_MEDIA_DELETE_REQUEST',
) {
  const params = parse(
    evidenceParamsSchema,
    req.params,
    'MEDIA_PRIVACY_EVIDENCE_PARAMS_INVALID',
  )

  const retentionRecord = await recordMediaRetentionAction({
    input: {
      imageEvidenceId: params.imageEvidenceId,
      organizationId: organizationId ? String(organizationId) : null,
      action: 'cleanup_requested',
      reasonCode,
      requestId: req.requestId,
      correlationId: '',
    },
    actorUserId: actorUserId(req),
  })

  return send(
    req,
    res,
    202,
    { retentionRecord },
    'Media cleanup request recorded.',
  )
}

export async function getCustomerMediaPrivacyState(req, res) {
  return stateForScope(req, res)
}

export async function recheckCustomerMediaPrivacy(req, res) {
  return recheckForScope(req, res)
}

export async function createCustomerMediaRedaction(req, res) {
  return redactionForScope(req, res)
}

export async function requestCustomerMediaCleanup(req, res) {
  return cleanupForScope(req, res)
}

export async function getHostMediaPrivacyState(req, res) {
  return stateForScope(req, res, await hostOrganizationId(req))
}

export async function recheckHostMediaPrivacy(req, res) {
  return recheckForScope(req, res, await hostOrganizationId(req))
}

export async function createHostMediaRedaction(req, res) {
  return redactionForScope(req, res, await hostOrganizationId(req))
}

export async function requestHostMediaCleanup(req, res) {
  return cleanupForScope(
    req,
    res,
    await hostOrganizationId(req),
    'HOST_PRIVACY_MEDIA_DELETE_REQUEST',
  )
}

export async function listAdminMediaPrivacyReviews(req, res) {
  const query = parse(
    reviewQuerySchema,
    req.query,
    'MEDIA_PRIVACY_REVIEW_QUERY_INVALID',
  )

  return send(
    req,
    res,
    200,
    await listPrivacyReviewCasesForAdmin(query),
    'Media privacy review queue loaded.',
  )
}

export async function getAdminMediaPrivacyReview(req, res) {
  const params = parse(
    reviewCaseParamsSchema,
    req.params,
    'MEDIA_PRIVACY_REVIEW_PARAMS_INVALID',
  )

  return send(
    req,
    res,
    200,
    {
      reviewCase: await getPrivacyReviewCaseForAdmin({
        privacyReviewCaseId: params.privacyReviewCaseId,
      }),
    },
    'Media privacy review case loaded.',
  )
}

export async function resolveAdminMediaPrivacyReview(req, res) {
  const params = parse(
    reviewCaseParamsSchema,
    req.params,
    'MEDIA_PRIVACY_REVIEW_PARAMS_INVALID',
  )

  const body = parse(
    reviewResolutionSchema,
    req.body,
    'MEDIA_PRIVACY_REVIEW_RESOLUTION_INVALID',
  )

  return send(
    req,
    res,
    200,
    {
      reviewCase: await resolvePrivacyReviewCaseForAdmin({
        privacyReviewCaseId: params.privacyReviewCaseId,
        reviewerUser: req.currentUser,
        adminAuthorization: req.adminAuthorization,
        decision: body.decision,
        resolutionNote: body.resolutionNote,
        requestId: req.requestId,
      }),
    },
    'Media privacy review resolved.',
  )
}
