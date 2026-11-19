import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { ApiError } from '../../utils/ApiError.js'
import { ApiResponse } from '../../utils/ApiResponse.js'
import { sensitiveResponseNoStoreMiddleware } from '../../middlewares/security.middleware.js'
import { authenticateSession, loadCurrentUser, requireActiveAccount, requireCsrfToken, requireMfaAssurance, requireRecentMfaAuthentication } from '../auth/auth.middleware.js'
import { loadAdminAuthorization, requireAdminAccess, requireAnyAdminPermission } from '../admin/adminPermission.middleware.js'
import { requireHostAccess } from '../auth/authorization.middleware.js'
import { HostUnifiedListingPacket } from '../hostOperations/hostUnifiedListing.models.js'
import { MarketplaceOrganization } from '../marketplace/marketplace.models.js'
import { createNotificationIntentBestEffort } from '../notifications/notification.service.js'
import { DsaTraderProfile } from './dsa.models.js'
import { ownerOrganization, submitTraderProfile, safeProfile, decideTraderProfile } from './dsa.trader.service.js'
import { governReportedHostListing } from './dsa.enforcement.service.js'
import { notifyReporterForDecision } from './dsa.noticeDelivery.service.js'
import { rejectPrivilegedImpersonation } from '../admin/adminSafety.middleware.js'
import {
  DsaNotice, DSA_REPORT_REASONS, DSA_OUTCOMES,
  makeReportAccessToken, tokenDigest, tokenMatches,
  publicReportView, validateDecisionTransition,
} from './dsa.models.js'

const router = Router()
router.use(sensitiveResponseNoStoreMiddleware)
const publicLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Too many reports. Please try again later.' } })
const lookupLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Too many status checks. Please try again later.' } })

const listingPath = z.string().trim().min(8).max(1000).refine((value) => {
  if (/^\/(grocery\/product|recipes|brands)\/[a-zA-Z0-9/._~%?=&-]+$/.test(value)) return true
  try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password }
  catch { return false }
}, 'Enter a product or recipe URL (HTTPS, or an EPANTRY product/recipe path).')
const submitSchema = z.strictObject({
  listingUrl: listingPath,
  reason: z.enum(DSA_REPORT_REASONS),
  explanation: z.string().trim().min(25).max(3000),
  evidenceUrl: z.union([z.literal(''), z.url().refine(v => v.startsWith('https://'), 'Use an HTTPS evidence URL.')]).optional().default(''),
  reporterContact: z.union([z.literal(''), z.email().max(254)]).optional().default(''),
  statementOfGoodFaith: z.literal(true),
})
const statusSchema = z.strictObject({ reference: z.string().regex(/^DSA-[A-Z0-9-]{30,60}$/), accessToken: z.string().min(35).max(128) })
const appealSchema = statusSchema.extend({ reason: z.string().trim().min(25).max(2200) })
const paramsSchema = z.strictObject({ reference: z.string().regex(/^DSA-[A-Z0-9-]{30,60}$/) })
const decisionSchema = z.strictObject({ outcome: z.enum(DSA_OUTCOMES), reason: z.string().trim().min(30).max(2200),
  enforcementReference: z.string().trim().max(300).optional().default('') }).superRefine((data, ctx) => {
    if (data.outcome !== 'no_violation_found' && !data.enforcementReference) ctx.addIssue({ code: 'custom', path: ['enforcementReference'], message: 'Record an actual governance, listing or external case reference for escalation.' })
  })
const traderSchema = z.strictObject({
  legalName: z.string().trim().min(2).max(240),
  postalAddress: z.string().trim().min(15).max(500),
  contactEmail: z.email().max(254),
  contactPhone: z.string().trim().min(7).max(35),
  businessRegister: z.string().trim().min(2).max(120),
  registrationNumber: z.string().trim().min(2).max(120),
  registrationEvidenceDocumentId: z.string().regex(/^[0-9a-f]{24}$/i),
  paymentEvidenceDocumentId: z.string().regex(/^[0-9a-f]{24}$/i),
  selfCertification: z.literal(true),
})
const traderDecisionSchema = z.strictObject({
  decision: z.enum(['verified', 'rejected']),
  reason: z.string().trim().min(30).max(1800),
})
const enforceSchema = z.strictObject({
  listingId: z.string().regex(/^[0-9a-f]{24}$/i),
  reason: z.string().trim().min(30).max(2200),
})
const reviewSchema = z.strictObject({ notes: z.string().trim().min(12).max(2000) })
const appealDecisionSchema = z.strictObject({ decision: z.enum(['upheld', 'reopened']), reason: z.string().trim().min(30).max(2200) })

function parse(schema, data) {
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message || 'Invalid report details.')
  return parsed.data
}
function run(fn) { return (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next) }
function ok(res, data, message = 'OK', code = 200) { return res.status(code).json(new ApiResponse(code, data, message)) }
function actorId(req) { return req.currentUser?._id || req.user?._id }
function notFound() { throw new ApiError(404, 'This report could not be found or the access key is invalid.') }
async function authorizedReport({ reference, accessToken }) {
  const record = await DsaNotice.findOne({ reference }).select('+accessTokenDigest')
  if (!record || !tokenMatches(accessToken, record.accessTokenDigest)) notFound()
  return record
}

// Guests may submit a notice; do not rely on a login session or send credentials in query strings.
router.post('/reports', publicLimit, run(async (req, res) => {
  const data = parse(submitSchema, req.body)
  const accessToken = makeReportAccessToken()
  const record = await DsaNotice.create({ ...data, accessTokenDigest: tokenDigest(accessToken),
    timeline: [{ event: 'submitted', actor: 'reporter', note: 'Notice received for assessment.' }] })
  return ok(res, { ...publicReportView(record), accessToken }, 'Report received. Save your reference and private access key.', 201)
}))
router.post('/reports/status', lookupLimit, run(async (req, res) => {
  const data = parse(statusSchema, req.body)
  return ok(res, publicReportView(await authorizedReport(data)), 'Report status loaded.')
}))
router.post('/reports/appeals', publicLimit, run(async (req, res) => {
  const data = parse(appealSchema, req.body)
  const record = await authorizedReport(data)
  if (!validateDecisionTransition(record, 'appeal')) throw new ApiError(409, 'Appeal is available only after the initial decision, once per decision.')
  record.status = 'appeal_pending'
  record.appealReason = data.reason
  record.appealActor = 'reporter'
  record.appealAt = new Date()
  record.timeline.push({ event: 'appeal_submitted', actor: 'reporter', note: 'Decision appealed.' })
  await record.save()
  return ok(res, publicReportView(record), 'Appeal received.')
}))

// Host sees only reports that have actually been enforced against their OWN listing.
const host = Router()
host.use(sensitiveResponseNoStoreMiddleware, authenticateSession, loadCurrentUser, requireActiveAccount, requireHostAccess)
host.get('/trader-profile', run(async (req, res) => {
  const org = await ownerOrganization(actorId(req))
  const profile = await DsaTraderProfile.findOne({ organizationId: org._id, ownerUserId: actorId(req) }).lean()
  return ok(res, { profile: safeProfile(profile) })
}))
host.post('/trader-profile', requireMfaAssurance, requireCsrfToken, requireRecentMfaAuthentication, run(async (req, res) => {
  const data = parse(traderSchema, req.body)
  const profile = await submitTraderProfile({ ownerUserId: actorId(req), data })
  return ok(res, { profile }, 'Trader declaration submitted for Super Admin verification.')
}))
host.get('/reports', run(async (req, res) => {
  const ids = await HostUnifiedListingPacket.find({ ownerUserId: actorId(req) }).distinct('_id')
  const notices = await DsaNotice.find({ enforcementListingId: { $in: ids } })
    .select('-accessTokenDigest -reporterContact -reviewNotes').sort({ updatedAt: -1 }).limit(100).lean()
  return ok(res, { reports: notices.map(n => ({ reference: n.reference, listingId: String(n.enforcementListingId),
    reason: n.reason, decisionReason: n.decisionReason, appealDecisionReason: n.appealDecisionReason,
    status: n.status, outcome: n.outcome, enforcementStatus: n.enforcementStatus,
    appealActor: n.appealActor, sellerAppealReason: n.sellerAppealReason,
    updatedAt: n.updatedAt })) })
}))
host.post('/reports/:reference/appeal', requireCsrfToken, run(async (req, res) => {
  const { reference } = parse(paramsSchema, req.params)
  const { reason } = parse(z.strictObject({ reason: z.string().trim().min(30).max(2200) }), req.body)
  const notice = await DsaNotice.findOne({ reference })
  if (!notice?.enforcementListingId || notice.enforcementStatus !== 'restricted') notFound()
  const owned = await HostUnifiedListingPacket.exists({ _id: notice.enforcementListingId, ownerUserId: actorId(req) })
  if (!owned) notFound()
  if (!validateDecisionTransition(notice, 'appeal')) throw new ApiError(409, 'This decision cannot receive another appeal.')
  notice.status = 'appeal_pending'
  notice.appealActor = 'seller'
  notice.appealAt = new Date()
  notice.sellerAppealReason = reason
  notice.timeline.push({ event: 'seller_appeal_submitted', actor: 'seller', note: 'Affected Host appealed the listing restriction.' })
  await notice.save()
  return ok(res, { reference, status: notice.status }, 'Seller appeal received for independent review.')
}))
router.use('/host', host)

const admin = Router()
admin.use(rejectPrivilegedImpersonation, authenticateSession, loadCurrentUser, requireActiveAccount,
  loadAdminAuthorization, requireAdminAccess, requireMfaAssurance)
const read = requireAnyAdminPermission('trust_safety.read')
const write = requireAnyAdminPermission('trust_safety.mutate')
admin.get('/reports', read, run(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : ''
  if (status && !['submitted', 'under_review', 'decision_issued', 'appeal_pending', 'appeal_decided'].includes(status)) throw new ApiError(400, 'Invalid status.')
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 25))
  const page = Math.max(1, Math.min(200, Number.parseInt(req.query.page, 10) || 1))
  const query = status ? { status } : {}
  const [items, total] = await Promise.all([
    DsaNotice.find(query).select('-accessTokenDigest').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    DsaNotice.countDocuments(query),
  ])
  return ok(res, { items, total, page, limit })
}))
admin.patch('/reports/:reference/review', write, requireCsrfToken, requireRecentMfaAuthentication, run(async (req, res) => {
  const { reference } = parse(paramsSchema, req.params)
  const { notes } = parse(reviewSchema, req.body)
  const record = await DsaNotice.findOne({ reference })
  if (!record) notFound()
  if (!['submitted', 'under_review'].includes(record.status)) throw new ApiError(409, 'This notice has already received a decision.')
  record.status = 'under_review'
  record.assignedTo = actorId(req)
  record.reviewNotes = notes
  record.timeline.push({ event: 'review_updated', actor: String(actorId(req)), note: notes })
  await record.save()
  return ok(res, { reference, status: record.status }, 'Review saved.')
}))
admin.patch('/reports/:reference/decision', write, requireCsrfToken, requireRecentMfaAuthentication, run(async (req, res) => {
  const { reference } = parse(paramsSchema, req.params)
  const { outcome, reason, enforcementReference } = parse(decisionSchema, req.body)
  const record = await DsaNotice.findOne({ reference })
  if (!record) notFound()
  if (!validateDecisionTransition(record, 'decide')) throw new ApiError(409, 'This notice cannot receive another initial decision.')
  record.status = 'decision_issued'
  record.outcome = outcome
  record.decisionReason = reason
  record.enforcementReference = enforcementReference
  record.decisionAt = new Date()
  record.decisionBy = actorId(req)
  record.timeline.push({ event: 'decision_issued', actor: String(actorId(req)), note: reason })
  await record.save()
  // A report decision is not itself product enforcement or proof of email delivery.
  const notification = await notifyReporterForDecision(record, 'decision')
  return ok(res, { reference, status: record.status, reporterNotification: notification.status },
    'Decision recorded. Apply any listing restrictions using governed enforcement controls.')
}))
admin.patch('/reports/:reference/appeal-decision', write, requireCsrfToken, requireRecentMfaAuthentication, run(async (req, res) => {
  const { reference } = parse(paramsSchema, req.params)
  const { decision, reason } = parse(appealDecisionSchema, req.body)
  const record = await DsaNotice.findOne({ reference })
  if (!record) notFound()
  if (!validateDecisionTransition(record, 'appealDecision')) throw new ApiError(409, 'No open appeal for this report.')
  if (record.decisionBy && String(record.decisionBy) === String(actorId(req))) throw new ApiError(403, 'An appeal requires a different reviewer from the original decision maker.')
  record.status = decision === 'reopened' ? 'under_review' : 'appeal_decided'
  record.appealDecision = decision
  record.appealDecisionReason = reason
  record.appealReviewer = actorId(req)
  record.timeline.push({ event: 'appeal_decision', actor: String(actorId(req)), note: reason })
  await record.save()
  const notification = await notifyReporterForDecision(record, 'appeal')
  return ok(res, { reference, status: record.status, reporterNotification: notification.status }, 'Appeal decision saved.')
}))
admin.post('/reports/:reference/retry-notice', write, requireCsrfToken, requireRecentMfaAuthentication,
  run(async (req, res) => {
    const { reference } = parse(paramsSchema, req.params)
    const { phase } = parse(z.strictObject({ phase: z.enum(['decision', 'appeal']) }), req.body)
    const record = await DsaNotice.findOne({ reference })
    if (!record) notFound()
    if (phase === 'decision' && !record.decisionAt || phase === 'appeal' && !record.appealDecisionReason) {
      throw new ApiError(409, 'No completed decision is available for notification.')
    }
    const last = phase === 'decision' ? record.reporterDecisionNotice : record.reporterAppealNotice
    if (last?.status === 'provider_accepted') throw new ApiError(409, 'The email provider already accepted this notification.')
    const result = await notifyReporterForDecision(record, phase)
    return ok(res, { reference, phase, ...result }, 'Delivery attempt recorded.')
  }))

admin.get('/traders', read, run(async (_req, res) => {
  const profiles = await DsaTraderProfile.find({ status: 'submitted' }).sort({ updatedAt: -1 }).limit(100).lean()
  return ok(res, { profiles: profiles.map(safeProfile) })
}))
admin.patch('/traders/:id/decision', write, requireCsrfToken, requireRecentMfaAuthentication, run(async (req, res) => {
  const { id } = parse(z.strictObject({ id: z.string().regex(/^[0-9a-f]{24}$/i) }), req.params)
  const { decision, reason } = parse(traderDecisionSchema, req.body)
  const profile = await decideTraderProfile({ id, decision, reason, actorId: actorId(req) })
  const record = await DsaTraderProfile.findById(id).select('ownerUserId').lean()
  if (record?.ownerUserId) await createNotificationIntentBestEffort({
    userId: record.ownerUserId, category: 'operations', triggerType: 'host_unified_listing_review',
    reasonCode: `dsa_trader_${decision}`, explanation: `EU trader verification ${decision}: ${reason}`,
    relatedEntityType: 'host_unified_listing', relatedEntityId: String(id), sourceDomain: 'dsa',
    sourceVersion: 'dsa-m4', actions: ['dismiss'], requestedChannels: ['in_app'],
    dedupeKey: `dsa-trader-${id}-${decision}-${profile.reviewedAt || 'rejected'}`,
  })
  return ok(res, { profile }, 'Trader verification decision recorded.')
}))

// A decision can lead to an actual restriction of the EXACT verified Host listing.
// Seller offers are paused in the same transaction. A referral alone cannot hide a listing.
admin.patch('/reports/:reference/restrict', write, requireCsrfToken, requireRecentMfaAuthentication, run(async (req, res) => {
  const { reference } = parse(paramsSchema, req.params)
  const { listingId, reason } = parse(enforceSchema, req.body)
  const result = await governReportedHostListing({ reference, listingId, reason, actorUser: req.currentUser, action: 'restrict' })
  return ok(res, result, 'Listing restricted and active offers paused; Host notification attempted.')
}))
admin.patch('/reports/:reference/lift', write, requireCsrfToken, requireRecentMfaAuthentication, run(async (req, res) => {
  const { reference } = parse(paramsSchema, req.params)
  const { listingId, reason } = parse(enforceSchema, req.body)
  const result = await governReportedHostListing({ reference, listingId, reason, actorUser: req.currentUser, action: 'lift' })
  return ok(res, result, 'Restriction lifted; selling offers remain paused for governed review.')
}))
router.use('/admin', admin)
export default router
