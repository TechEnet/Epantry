import mongoose from 'mongoose'

import { ApiError } from '../../utils/ApiError.js'

import { buildSignedProductEvidenceUrl } from '../../integrations/media/cloudinary.provider.js'

import { recordAdminAuditEvent } from '../admin/adminAudit.service.js'

import { ImageEvidence } from '../universalProduct/universalProduct.models.js'

import { User } from '../users/user.model.js'

import {
  MediaRetentionRecord,
  MediaSafetyAssessment,
  PrivacyReviewCase,
  RedactionJob,
} from './mediaPrivacy.models.js'

import {
  buildSuggestedRedactionOperations,
  deriveMediaPrivacyDecision,
  normalizeMediaPrivacyDetectorResult,
} from './mediaPrivacy.detector.service.js'

import {
  parseCreateMediaRedactionJobInput,
  parseFailMediaRedactionJobInput,
  parseMediaPrivacyAssessmentInput,
  parseMediaRetentionRequest,
} from './mediaPrivacy.validation.js'

export const MEDIA_PRIVACY_DEFAULT_ORIGINAL_RETENTION_DAYS = 7

function id(value) {
  if (value === null || value === undefined) {
    return null
  }

  return String(value?._id || value)
}

function sameId(left, right) {
  return id(left) === id(right)
}

function clean(value) {
  return String(value || '').trim()
}

function apiError(statusCode, message, code) {
  return new ApiError(statusCode, message, [{ code }])
}

function defaultOriginalRetainUntil() {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + MEDIA_PRIVACY_DEFAULT_ORIGINAL_RETENTION_DAYS)
  return date
}

function serializeFinding(item) {
  return {
    riskType: item?.riskType,
    severity: item?.severity,
    confidence: item?.confidence,
    boundingBox: item?.boundingBox || null,
    reasonCode: item?.reasonCode,
  }
}

export function serializeMediaSafetyAssessment(value) {
  if (!value) return null
  const item = typeof value.toObject === 'function' ? value.toObject() : value

  return {
    id: id(item._id),
    assessmentId: item.assessmentId,
    imageEvidenceId: id(item.imageEvidenceId),
    decision: item.decision,
    detectorStatus: item.detectorStatus,
    metadataStatus: item.metadataStatus,
    metadataStripped: Boolean(item.metadataStripped),
    highestSeverity: item.highestSeverity || null,
    findings: (item.findings || []).map(serializeFinding),
    reasonCodes: item.reasonCodes || [],
    scannerVersion: item.scannerVersion,
    assessedAt: item.assessedAt || null,
  }
}

export function serializePrivacyReviewCase(value) {
  if (!value) return null
  const item = typeof value.toObject === 'function' ? value.toObject() : value

  return {
    id: id(item._id),
    privacyReviewCaseId: item.privacyReviewCaseId,
    imageEvidenceId: id(item.imageEvidenceId),
    assessmentId: id(item.assessmentId),
    status: item.status,
    reasonCodes: item.reasonCodes || [],
    decision: item.decision || null,
    assignedToUserId: id(item.assignedToUserId),
    resolutionNote: item.resolutionNote || '',
    resolvedAt: item.resolvedAt || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

export function serializeRedactionJob(value) {
  if (!value) return null
  const item = typeof value.toObject === 'function' ? value.toObject() : value

  return {
    id: id(item._id),
    redactionJobId: item.redactionJobId,
    sourceImageEvidenceId: id(item.sourceImageEvidenceId),
    sourceAssessmentId: id(item.sourceAssessmentId),
    status: item.status,
    operations: item.operations || [],
    outputImageEvidenceId: id(item.outputImageEvidenceId),
    outputAssessmentId: id(item.outputAssessmentId),
    originalRetainUntil: item.originalRetainUntil || null,
    attemptCount: item.attemptCount || 0,
    startedAt: item.startedAt || null,
    completedAt: item.completedAt || null,
    failureCode: item.failureCode || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

async function requireScopedImageEvidence({
  imageEvidenceId,
  actorUserId,
  organizationId = null,
  allowDeleted = false,
}) {
  if (!mongoose.isValidObjectId(imageEvidenceId)) {
    throw apiError(400, 'Invalid media evidence identity.', 'MEDIA_EVIDENCE_ID_INVALID')
  }

  const evidence = await ImageEvidence.findById(imageEvidenceId)

  if (!evidence) {
    throw apiError(404, 'Media evidence was not found.', 'MEDIA_EVIDENCE_NOT_FOUND')
  }

  if (!sameId(evidence.ownerUserId, actorUserId)) {
    throw apiError(403, 'Media evidence is outside the authenticated owner scope.', 'MEDIA_EVIDENCE_OWNER_FORBIDDEN')
  }

  if (!sameId(evidence.organizationId, organizationId)) {
    throw apiError(403, 'Media evidence is outside the requested organization scope.', 'MEDIA_EVIDENCE_ORGANIZATION_FORBIDDEN')
  }

  if (!allowDeleted && evidence.status === 'deleted') {
    throw apiError(409, 'Deleted media evidence cannot be processed.', 'MEDIA_EVIDENCE_DELETED')
  }

  return evidence
}

async function createReviewCaseIfNeeded({ assessment, evidence }) {
  if (assessment.decision === 'safe_to_use') {
    return null
  }

  const existing = await PrivacyReviewCase.findOne({
    imageEvidenceId: evidence._id,
    status: { $in: ['open', 'in_review'] },
  })

  if (existing) {
    return existing
  }

  return PrivacyReviewCase.create({
    imageEvidenceId: evidence._id,
    assessmentId: assessment._id,
    ownerUserId: evidence.ownerUserId,
    organizationId: evidence.organizationId || null,
    reasonCodes: assessment.reasonCodes || [],
    status: 'open',
  })
}

export async function assessMediaPrivacy({
  input,
  actorUserId,
}) {
  const parsed = parseMediaPrivacyAssessmentInput(input)

  const evidence = await requireScopedImageEvidence({
    imageEvidenceId: parsed.imageEvidenceId,
    actorUserId,
    organizationId: parsed.organizationId,
  })

  const detectorResult = normalizeMediaPrivacyDetectorResult(parsed.detectorResult)
  const decision = deriveMediaPrivacyDecision({
    detectorResult,
    metadataResult: parsed.metadataResult,
  })

  const assessment = await MediaSafetyAssessment.create({
    imageEvidenceId: evidence._id,
    ownerUserId: evidence.ownerUserId,
    organizationId: evidence.organizationId || null,
    detectorProvider: detectorResult.provider,
    detectorModel: detectorResult.model,
    detectorStatus: detectorResult.status,
    metadataStatus: parsed.metadataResult.status,
    metadataStripped: parsed.metadataResult.stripped,
    decision: decision.decision,
    highestSeverity: decision.highestSeverity,
    findings: detectorResult.findings,
    reasonCodes: decision.reasonCodes,
    scannerVersion: detectorResult.scannerVersion,
    requestId: parsed.requestId,
    correlationId: parsed.correlationId,
    assessedAt: new Date(),
  })

  const reviewCase = await createReviewCaseIfNeeded({ assessment, evidence })

  return {
    assessment: serializeMediaSafetyAssessment(assessment),
    reviewCase: serializePrivacyReviewCase(reviewCase),
    suggestedRedactions:
      assessment.decision === 'redaction_required'
        ? buildSuggestedRedactionOperations(detectorResult.findings)
        : [],
  }
}

export async function getLatestMediaPrivacyState({
  imageEvidenceId,
  actorUserId,
  organizationId = null,
}) {
  const evidence = await requireScopedImageEvidence({
    imageEvidenceId,
    actorUserId,
    organizationId,
    allowDeleted: true,
  })

  const [assessment, reviewCase, redactionJob] = await Promise.all([
    MediaSafetyAssessment.findOne({ imageEvidenceId: evidence._id })
      .sort({ assessedAt: -1, createdAt: -1 })
      .lean(),
    PrivacyReviewCase.findOne({ imageEvidenceId: evidence._id })
      .sort({ createdAt: -1 })
      .lean(),
    RedactionJob.findOne({ sourceImageEvidenceId: evidence._id })
      .sort({ createdAt: -1 })
      .lean(),
  ])

  return {
    imageEvidenceId: id(evidence._id),
    mediaStatus: evidence.status,
    assessment: serializeMediaSafetyAssessment(assessment),
    reviewCase: serializePrivacyReviewCase(reviewCase),
    redactionJob: serializeRedactionJob(redactionJob),
  }
}

export async function createMediaRedactionJob({
  input,
  actorUserId,
}) {
  const parsed = parseCreateMediaRedactionJobInput(input)

  const evidence = await requireScopedImageEvidence({
    imageEvidenceId: parsed.imageEvidenceId,
    actorUserId,
    organizationId: parsed.organizationId,
  })

  const assessment = await MediaSafetyAssessment.findOne({
    _id: parsed.assessmentId,
    imageEvidenceId: evidence._id,
  })

  if (!assessment) {
    throw apiError(404, 'Media privacy assessment was not found for this evidence.', 'MEDIA_PRIVACY_ASSESSMENT_NOT_FOUND')
  }

  if (!['needs_review', 'redaction_required'].includes(assessment.decision)) {
    throw apiError(409, 'Redaction is not required by the selected privacy assessment.', 'MEDIA_REDACTION_NOT_REQUIRED')
  }

  const existing = await RedactionJob.findOne({
    sourceImageEvidenceId: evidence._id,
    status: { $in: ['queued', 'processing'] },
  })

  if (existing) {
    return serializeRedactionJob(existing)
  }

  const job = await RedactionJob.create({
    sourceImageEvidenceId: evidence._id,
    sourceAssessmentId: assessment._id,
    ownerUserId: evidence.ownerUserId,
    organizationId: evidence.organizationId || null,
    requestedByUserId: actorUserId,
    operations: parsed.operations,
    status: 'queued',
    originalRetainUntil: parsed.originalRetainUntil,
  })

  await MediaRetentionRecord.create({
    imageEvidenceId: evidence._id,
    ownerUserId: evidence.ownerUserId,
    organizationId: evidence.organizationId || null,
    action: 'retain_until',
    reasonCode: 'REDACTION_IN_PROGRESS',
    retainUntil: parsed.originalRetainUntil,
    actorUserId,
  })

  return serializeRedactionJob(job)
}

export async function startMediaRedactionJob({ redactionJobId }) {
  const job = await RedactionJob.findOneAndUpdate(
    { _id: redactionJobId, status: 'queued' },
    {
      $set: { status: 'processing', startedAt: new Date(), failureCode: '' },
      $inc: { attemptCount: 1 },
    },
    { new: true },
  )

  if (!job) {
    throw apiError(409, 'Redaction job is not available to start.', 'MEDIA_REDACTION_START_CONFLICT')
  }

  return serializeRedactionJob(job)
}

export async function completeMediaRedactionJob({
  redactionJobId,
  outputImageEvidenceId,
}) {
  const job = await RedactionJob.findOne({
    _id: redactionJobId,
    status: 'processing',
  })

  if (!job) {
    throw apiError(409, 'Redaction job is not processing.', 'MEDIA_REDACTION_COMPLETE_CONFLICT')
  }

  if (sameId(job.sourceImageEvidenceId, outputImageEvidenceId)) {
    throw apiError(409, 'Redacted output must be a separate governed media asset.', 'MEDIA_REDACTION_OUTPUT_MUST_DIFFER')
  }

  const output = await ImageEvidence.findById(outputImageEvidenceId)

  if (
    !output ||
    !sameId(output.ownerUserId, job.ownerUserId) ||
    !sameId(output.organizationId, job.organizationId) ||
    output.status === 'deleted'
  ) {
    throw apiError(409, 'Redacted output evidence is missing or outside the source scope.', 'MEDIA_REDACTION_OUTPUT_INVALID')
  }

  job.status = 'succeeded'
  job.outputImageEvidenceId = output._id
  job.completedAt = new Date()
  job.failureCode = ''
  await job.save()

  await MediaRetentionRecord.create({
    imageEvidenceId: job.sourceImageEvidenceId,
    ownerUserId: job.ownerUserId,
    organizationId: job.organizationId || null,
    action: 'cleanup_requested',
    reasonCode: 'REDACTED_COPY_CREATED',
    retainUntil: job.originalRetainUntil || defaultOriginalRetainUntil(),
    actorUserId: job.requestedByUserId,
  })

  return serializeRedactionJob(job)
}

export async function failMediaRedactionJob({ input }) {
  const parsed = parseFailMediaRedactionJobInput(input)

  const job = await RedactionJob.findOneAndUpdate(
    { _id: parsed.redactionJobId, status: 'processing' },
    {
      $set: {
        status: 'failed',
        failureCode: parsed.failureCode,
        completedAt: new Date(),
      },
    },
    { new: true },
  )

  if (!job) {
    throw apiError(409, 'Redaction job is not processing.', 'MEDIA_REDACTION_FAIL_CONFLICT')
  }

  return serializeRedactionJob(job)
}

export async function recordMediaRetentionAction({
  input,
  actorUserId,
}) {
  const parsed = parseMediaRetentionRequest(input)

  const evidence = await requireScopedImageEvidence({
    imageEvidenceId: parsed.imageEvidenceId,
    actorUserId,
    organizationId: parsed.organizationId,
    allowDeleted: true,
  })

  const record = await MediaRetentionRecord.create({
    imageEvidenceId: evidence._id,
    ownerUserId: evidence.ownerUserId,
    organizationId: evidence.organizationId || null,
    action: parsed.action,
    reasonCode: parsed.reasonCode,
    policyKey: parsed.policyKey,
    policyVersion: parsed.policyVersion,
    retainUntil: parsed.retainUntil,
    actorUserId,
    requestId: parsed.requestId,
    correlationId: parsed.correlationId,
    occurredAt: new Date(),
  })

  return {
    id: id(record._id),
    retentionRecordId: record.retentionRecordId,
    imageEvidenceId: id(record.imageEvidenceId),
    action: record.action,
    reasonCode: record.reasonCode,
    retainUntil: record.retainUntil || null,
    occurredAt: record.occurredAt,
  }
}

export async function resolvePrivacyReviewCase({
  privacyReviewCaseId,
  reviewerUserId,
  decision,
  resolutionNote,
}) {
  if (!['safe_to_use', 'redaction_required', 'reupload_required', 'delete_media'].includes(decision)) {
    throw apiError(400, 'Invalid privacy review decision.', 'MEDIA_PRIVACY_REVIEW_DECISION_INVALID')
  }

  const reviewCase = await PrivacyReviewCase.findOne({
    _id: privacyReviewCaseId,
    status: { $in: ['open', 'in_review'] },
  })

  if (!reviewCase) {
    throw apiError(404, 'Open privacy review case was not found.', 'MEDIA_PRIVACY_REVIEW_CASE_NOT_FOUND')
  }

  reviewCase.status = 'resolved'
  reviewCase.decision = decision
  reviewCase.resolutionNote = clean(resolutionNote).slice(0, 1000)
  reviewCase.resolvedAt = new Date()
  reviewCase.resolvedByUserId = reviewerUserId
  await reviewCase.save()

  if (decision === 'delete_media') {
    await MediaRetentionRecord.create({
      imageEvidenceId: reviewCase.imageEvidenceId,
      ownerUserId: reviewCase.ownerUserId,
      organizationId: reviewCase.organizationId || null,
      action: 'cleanup_requested',
      reasonCode: 'PRIVACY_REVIEW_DELETE_MEDIA',
      actorUserId: reviewerUserId,
    })
  }

  return serializePrivacyReviewCase(reviewCase)
}


function normalizePage(value, fallback = 1) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeLimit(value, fallback = 20) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, 100)
    : fallback
}

async function buildAdminReviewCaseView(reviewCase) {
  if (!reviewCase) return null

  const item = typeof reviewCase.toObject === 'function'
    ? reviewCase.toObject()
    : reviewCase

  const [assessment, evidence, owner] = await Promise.all([
    MediaSafetyAssessment.findById(item.assessmentId).lean(),
    ImageEvidence.findById(item.imageEvidenceId).lean(),
    User.findById(item.ownerUserId)
      .select({ email: 1, firstName: 1, lastName: 1 })
      .lean(),
  ])

  let previewUrl = ''

  if (evidence && evidence.status !== 'deleted') {
    try {
      previewUrl = buildSignedProductEvidenceUrl({
        publicId: evidence.publicId,
        version: evidence.version,
        format: evidence.format,
      })
    } catch {
      previewUrl = ''
    }
  }

  return {
    ...serializePrivacyReviewCase(item),
    owner: owner
      ? {
          id: id(owner._id),
          email: owner.email || '',
          displayName: [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim(),
        }
      : null,
    organizationId: id(item.organizationId),
    assessment: serializeMediaSafetyAssessment(assessment),
    evidence: evidence
      ? {
          id: id(evidence._id),
          purpose: evidence.purpose,
          status: evidence.status,
          mimeType: evidence.mimeType,
          bytes: evidence.bytes,
          width: evidence.width || null,
          height: evidence.height || null,
          capturedAt: evidence.capturedAt || null,
          previewUrl,
        }
      : null,
  }
}

export async function listPrivacyReviewCasesForAdmin({
  page = 1,
  limit = 20,
  status = 'open',
} = {}) {
  const safePage = normalizePage(page)
  const safeLimit = normalizeLimit(limit)
  const filter = {}

  if (status && status !== 'all') {
    if (!['open', 'in_review', 'resolved', 'cancelled'].includes(status)) {
      throw apiError(400, 'Invalid privacy review status filter.', 'MEDIA_PRIVACY_REVIEW_STATUS_INVALID')
    }

    filter.status = status
  }

  const [items, total] = await Promise.all([
    PrivacyReviewCase.find(filter)
      .sort({ createdAt: status === 'resolved' ? -1 : 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    PrivacyReviewCase.countDocuments(filter),
  ])

  const reviewCases = []

  for (const item of items) {
    reviewCases.push(await buildAdminReviewCaseView(item))
  }

  return {
    reviewCases,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  }
}

export async function getPrivacyReviewCaseForAdmin({ privacyReviewCaseId }) {
  if (!mongoose.isValidObjectId(privacyReviewCaseId)) {
    throw apiError(400, 'Invalid privacy review case identity.', 'MEDIA_PRIVACY_REVIEW_CASE_ID_INVALID')
  }

  const reviewCase = await PrivacyReviewCase.findById(privacyReviewCaseId).lean()

  if (!reviewCase) {
    throw apiError(404, 'Privacy review case was not found.', 'MEDIA_PRIVACY_REVIEW_CASE_NOT_FOUND')
  }

  return buildAdminReviewCaseView(reviewCase)
}

export async function resolvePrivacyReviewCaseForAdmin({
  privacyReviewCaseId,
  reviewerUser,
  adminAuthorization,
  decision,
  resolutionNote,
  requestId,
}) {
  const before = await getPrivacyReviewCaseForAdmin({ privacyReviewCaseId })

  const beforeAuditSnapshot = {
    ...before,
    evidence: before?.evidence
      ? {
          ...before.evidence,
          previewUrl: '',
        }
      : null,
  }

  const resolved = await resolvePrivacyReviewCase({
    privacyReviewCaseId,
    reviewerUserId: reviewerUser?._id || reviewerUser?.id,
    decision,
    resolutionNote,
  })

  await recordAdminAuditEvent({
    actorUser: reviewerUser,
    adminAuthorization,
    action: 'media_privacy.review.resolve',
    permissionKey: 'trust_safety.mutate',
    entityType: 'privacy_review_case',
    entityId: privacyReviewCaseId,
    reasonCode: 'trust_safety.enforcement',
    reasonDetails: clean(resolutionNote) || `Media privacy review resolved as ${decision}.`,
    beforeSnapshot: beforeAuditSnapshot,
    afterSnapshot: resolved,
    metadata: {
      decision,
      imageEvidenceId: before?.imageEvidenceId || null,
    },
    requestId,
  })

  return getPrivacyReviewCaseForAdmin({ privacyReviewCaseId })
}
