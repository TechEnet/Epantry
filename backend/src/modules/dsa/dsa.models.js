import crypto from 'node:crypto'
import mongoose from 'mongoose'

const { Schema } = mongoose

export const DSA_REPORT_REASONS = Object.freeze([
  'illegal_product', 'unsafe_food', 'misleading_claim', 'counterfeit',
  'fraud', 'privacy_concern', 'other',
])
export const DSA_OUTCOMES = Object.freeze([
  'no_violation_found', 'referred_for_listing_review', 'referred_for_seller_review',
  'referred_to_authority',
])
export const DSA_STATUSES = Object.freeze([
  'submitted', 'under_review', 'decision_issued', 'appeal_pending', 'appeal_decided',
])

const eventSchema = new Schema({
  event: { type: String, required: true, maxlength: 60 },
  at: { type: Date, required: true, default: Date.now },
  actor: { type: String, maxlength: 120, default: 'system' },
  note: { type: String, maxlength: 1600, default: '' },
}, { _id: false })

const reporterDeliverySchema = new Schema({
  status: { type: String, enum: ['not_requested', 'provider_accepted', 'failed', 'configuration_missing'], default: 'not_requested' },
  attemptCount: { type: Number, min: 0, default: 0 },
  lastAttemptAt: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  errorCode: { type: String, maxlength: 120, default: '' },
}, { _id: false })

const schema = new Schema({
  reference: { type: String, unique: true, immutable: true, required: true,
    default: () => `DSA-${crypto.randomUUID().toUpperCase()}` },
  accessTokenDigest: { type: String, required: true, select: false },
  listingUrl: { type: String, required: true, trim: true, maxlength: 1000 },
  reason: { type: String, enum: DSA_REPORT_REASONS, required: true },
  explanation: { type: String, trim: true, required: true, maxlength: 3000 },
  evidenceUrl: { type: String, trim: true, maxlength: 1000, default: '' },
  reporterContact: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  statementOfGoodFaith: { type: Boolean, required: true },
  status: { type: String, enum: DSA_STATUSES, default: 'submitted', index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reviewNotes: { type: String, maxlength: 2000, default: '' },
  outcome: { type: String, enum: DSA_OUTCOMES, default: undefined },
  decisionReason: { type: String, maxlength: 2200, default: '' },
  decisionAt: { type: Date, default: null },
  decisionBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  enforcementReference: { type: String, maxlength: 300, default: '' },
  enforcementListingId: { type: Schema.Types.ObjectId, ref: 'HostUnifiedListingPacket', default: null, index: true },
  enforcementStatus: { type: String, enum: ['not_applied', 'restricted', 'lifted'], default: 'not_applied' },
  enforcedAt: { type: Date, default: null },
  enforcedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  restrictionLiftedAt: { type: Date, default: null },
  appealActor: { type: String, enum: ['reporter', 'seller'], default: null },
  sellerAppealReason: { type: String, maxlength: 2200, default: '' },
  sellerNoticeAttemptedAt: { type: Date, default: null },
  reporterDecisionNotice: { type: reporterDeliverySchema, default: () => ({}) },
  reporterAppealNotice: { type: reporterDeliverySchema, default: () => ({}) },
  appealReason: { type: String, maxlength: 2200, default: '' },
  appealAt: { type: Date, default: null },
  appealDecision: { type: String, enum: ['upheld', 'reopened'], default: undefined },
  appealDecisionReason: { type: String, maxlength: 2200, default: '' },
  appealReviewer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  timeline: { type: [eventSchema], default: [] },
}, { timestamps: true, versionKey: '__v', optimisticConcurrency: true, strict: true })

schema.index({ createdAt: -1 })
schema.index({ status: 1, createdAt: -1 })

export const DsaNotice = mongoose.models.DsaNotice || mongoose.model('DsaNotice', schema)

// Supplemental EU trader traceability; the existing Host KYB remains authoritative.
// Only references to existing reviewed private documents are stored (no raw bank data).
const traderSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'MarketplaceOrganization', required: true, unique: true, index: true },
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  legalName: { type: String, required: true, trim: true, maxlength: 240 },
  postalAddress: { type: String, required: true, trim: true, maxlength: 500 },
  contactEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  contactPhone: { type: String, required: true, trim: true, maxlength: 35 },
  businessRegister: { type: String, required: true, trim: true, maxlength: 120 },
  registrationNumber: { type: String, required: true, trim: true, maxlength: 120 },
  registrationEvidenceDocumentId: { type: Schema.Types.ObjectId, ref: 'HostOrganizationDocument', required: true },
  paymentEvidenceDocumentId: { type: Schema.Types.ObjectId, ref: 'HostOrganizationDocument', required: true },
  selfCertification: { type: Boolean, required: true },
  status: { type: String, enum: ['submitted', 'verified', 'rejected'], default: 'submitted', index: true },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reviewReason: { type: String, trim: true, maxlength: 1800, default: '' },
  reviewHistory: [{ at: { type: Date, default: Date.now }, reviewerId: { type: Schema.Types.ObjectId, ref: 'User' }, decision: String, reason: String }],
}, { timestamps: true, optimisticConcurrency: true, versionKey: '__v' })
export const DsaTraderProfile = mongoose.models.DsaTraderProfile || mongoose.model('DsaTraderProfile', traderSchema)

export function makeReportAccessToken() {
  return crypto.randomBytes(32).toString('base64url')
}
export function tokenDigest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}
export function tokenMatches(token, digest) {
  if (typeof token !== 'string' || token.length < 35 || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) return false
  if (typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest)) return false
  return crypto.timingSafeEqual(Buffer.from(tokenDigest(token), 'hex'), Buffer.from(digest, 'hex'))
}
export function publicReportView(item) {
  return {
    reference: item.reference, status: item.status, listingUrl: item.listingUrl,
    reason: item.reason, createdAt: item.createdAt, updatedAt: item.updatedAt,
    outcome: item.outcome || null, decisionReason: item.decisionReason || '',
    decisionAt: item.decisionAt || null, appealAt: item.appealAt || null,
    enforcementStatus: item.enforcementStatus || 'not_applied',
    appealDecision: item.appealDecision || null,
    appealDecisionReason: item.appealDecisionReason || '',
    // Internal evidence, moderation notes and reporter email are never in public status.
  }
}

export function validateDecisionTransition(report, kind) {
  if (kind === 'decide' && !['submitted', 'under_review'].includes(report.status)) return false
  if (kind === 'appeal' && report.status !== 'decision_issued') return false
  if (kind === 'appealDecision' && report.status !== 'appeal_pending') return false
  return true
}
