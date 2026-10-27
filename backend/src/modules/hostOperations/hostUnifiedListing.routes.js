import { Router } from 'express'
import { rejectPrivilegedImpersonation } from '../admin/adminSafety.middleware.js'
import { loadAdminAuthorization, requireAdminAccess } from '../admin/adminPermission.middleware.js'
import { createNotificationIntentBestEffort, notifyActiveSuperAdminsBestEffort } from '../notifications/notification.service.js'
import { createHostListingImageUploadIntent, createHostListingVideoUploadIntent } from '../../integrations/media/cloudinary.provider.js'
import { ApiError } from '../../utils/ApiError.js'
import { authenticateSession, loadCurrentUser, requireActiveAccount, requireCsrfToken, requireMfaAssurance, requireRecentMfaAuthentication } from '../auth/auth.middleware.js'
import { requireHostAccess } from '../auth/authorization.middleware.js'
import { sensitiveResponseNoStoreMiddleware } from '../../middlewares/security.middleware.js'
import { CanonicalIngredient } from '../catalog/catalog.models.js'
import { HostUnifiedListingPacket } from './hostUnifiedListing.models.js'
import { publicListing } from './hostUnifiedListing.public.js'
import { normalizeListingWorkspace, normalizeListingPacket, validateListingPacket, calculateListingEstimate } from './hostUnifiedListing.logic.js'
import { importHostListingRemoteImage } from './hostListingMediaImport.service.js'

const router = Router()
const SECTIONS = new Set(['details', 'media', 'ingredients', 'steps', 'nutrition', 'selling', 'delivery'])
const adminSecurity = [sensitiveResponseNoStoreMiddleware, rejectPrivilegedImpersonation, authenticateSession, loadCurrentUser, requireActiveAccount, loadAdminAuthorization, requireAdminAccess, requireMfaAssurance]
const adminWrite = [...adminSecurity, requireCsrfToken, requireRecentMfaAuthentication]
function superAdminOnly(req, res, next) {
  return req.currentUser?.superAdminEnabled === true ? next() : next(new ApiError(403, 'Super Admin authorization is required.'))
}
function objectId(value) { return /^[a-f\d]{24}$/i.test(String(value || '')) }

const readSecurity = [sensitiveResponseNoStoreMiddleware, authenticateSession, loadCurrentUser, requireActiveAccount, requireHostAccess, requireMfaAssurance]
const writeSecurity = [...readSecurity, requireCsrfToken, requireRecentMfaAuthentication]
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
function actor(req) {
  const id = req.currentUser?._id || req.currentUser?.id
  if (!id) throw new ApiError(401, 'Host sign-in is required.')
  return id
}
function respond(res, data, code = 200) { return res.status(code).json({ success: true, data }) }
function context(req) { return { ownerUserId: actor(req), workspaceType: normalizeListingWorkspace(req.currentUser?.hostWorkspaceType) } }
function problem(message, status = 400) { throw new ApiError(status, message) }
function cleanIncoming(raw, workspace, submit = false) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) problem('Provide a listing object.')
  if ((raw.ingredients?.length || 0) > 100 || (raw.steps?.length || 0) > 75 || (raw.images?.length || 0) > 12) problem('Too many ingredients, steps or photos in this listing.')
  if (JSON.stringify(raw).length > 180000) problem('Listing packet exceeds the size limit.')
  const codes = raw.delivery?.postalCodes
  if (Array.isArray(codes) && codes.some((value) => !/^[1-9][0-9]{5}$/.test(String(value).trim()))) problem('Enter only valid six-digit delivery pincodes.')
  const packet = normalizeListingPacket(raw)
  const errors = validateListingPacket(packet, { workspace, submit })
  if (errors.length) problem(errors.join(' '))
  return packet
}
async function ownedRecord(req) {
  if (!/^[a-f\d]{24}$/i.test(String(req.params.id || ''))) problem('Invalid listing identifier.')
  const record = await HostUnifiedListingPacket.findOne({ _id: req.params.id, ownerUserId: actor(req), deletedAt: null })
  if (!record) problem('Listing not found in this Host workspace.', 404)
  return record
}
function serialize(record) {
  return { id: String(record.id), status: record.status, type: record.type, title: record.title,
    packet: record.packet, bulkBatchId: record.bulkBatchId, updatedAt: record.updatedAt,
    submittedAt: record.submittedAt, approvedAt: record.approvedAt,
    reviewedAt: record.reviewedAt, correctionSection: record.correctionSection,
    reviewNote: record.reviewNote, reviewRevision: record.reviewRevision,
    reviewHistory: record.reviewHistory || [],
    estimate: calculateListingEstimate(record.packet) }
}

router.post('/host/listing-packets/image-upload-intent', ...writeSecurity, wrap(async (req, res) => {
  try { respond(res, { uploadIntent: createHostListingImageUploadIntent({ userId: actor(req) }) }) }
  catch (error) { problem(error?.code === 'CLOUDINARY_NOT_CONFIGURED' ? 'Image upload provider is not configured.' : 'Unable to prepare image upload.', 503) }
}))

// Public Google Drive images are imported server-side into our own Cloudinary storage.
// The only accepted remote host is drive.google.com; arbitrary URL fetching is forbidden.
router.post('/host/listing-packets/import-image', ...writeSecurity, wrap(async (req, res) => {
  try {
    const imageUrl = await importHostListingRemoteImage(req.body?.sourceUrl)
    respond(res, { imageUrl })
  } catch (error) {
    problem(error?.message || 'Unable to import this image.', error?.code === 'MEDIA_NOT_CONFIGURED' ? 503 : 422)
  }
}))

router.post('/host/listing-packets/video-upload-intent', ...writeSecurity, wrap(async (req, res) => {
  try { respond(res, { uploadIntent: createHostListingVideoUploadIntent({ userId: actor(req) }) }) }
  catch (error) { problem(error?.code === 'CLOUDINARY_NOT_CONFIGURED' ? 'Video upload provider is not configured.' : 'Unable to prepare video upload.', 503) }
}))

// Host Studio's ingredient picker must use Host authorization rather than
// the Customer-only Community composer lookup. No create/edit permissions here.
router.get('/host/listing-packets/catalog/ingredients', ...readSecurity, wrap(async (req, res) => {
  const search = String(req.query?.search || '').trim()
  if (search.length < 2) return respond(res, { ingredients: [] })
  if (search.length > 120) problem('Ingredient search is too long.')
  const requestedLimit = Number(req.query?.limit)
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(20, Math.floor(requestedLimit))) : 6
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const expression = new RegExp(escaped, 'i')
  const rows = await CanonicalIngredient.find({
    status: 'active',
    $or: [{ canonicalName: expression }, { aliases: expression }, { slug: expression }],
  }).sort({ canonicalName: 1 }).limit(limit).select('_id canonicalName slug aliases').lean()
  respond(res, { ingredients: rows.map(row => ({
    id: String(row._id), canonicalName: row.canonicalName, slug: row.slug,
    aliases: row.aliases || [],
  })) })
}))

router.get('/host/listing-packets', ...readSecurity, wrap(async (req, res) => {
  const records = await HostUnifiedListingPacket.find({ ownerUserId: actor(req), deletedAt: null }).sort({ updatedAt: -1 }).limit(100)
  respond(res, { listings: records.map(serialize) })
}))
router.get('/host/listing-packets/:id', ...readSecurity, wrap(async (req, res) => {
  respond(res, { listing: serialize(await ownedRecord(req)) })
}))
router.post('/host/listing-packets', ...writeSecurity, wrap(async (req, res) => {
  const { ownerUserId, workspaceType } = context(req)
  const packet = cleanIncoming(req.body?.packet, workspaceType)
  const record = await HostUnifiedListingPacket.create({ ownerUserId, workspaceType, type: packet.type, title: packet.title, packet })
  respond(res, { listing: serialize(record) }, 201)
}))
router.patch('/host/listing-packets/:id', ...writeSecurity, wrap(async (req, res) => {
  const record = await ownedRecord(req)
  if (!['draft', 'changes_requested'].includes(record.status)) problem('Submitted listings are locked until Super Admin requests corrections.', 409)
  const packet = cleanIncoming(req.body?.packet, record.workspaceType)
  record.packet = packet
  record.type = packet.type
  record.title = packet.title
  await record.save()
  respond(res, { listing: serialize(record) })
}))
// Restricted Host update for previously submitted, approved or rejected listings.
// This does not bypass Super Admin review. Approved records leave the public
// catalog until the updated packet is reviewed and approved again.
router.post('/host/listing-packets/:id/section-revision', ...writeSecurity, wrap(async (req, res) => {
  const record = await ownedRecord(req)
  if (!['submitted_for_review', 'approved', 'rejected'].includes(record.status)) {
    problem('Use Save full draft for an editable draft or changes-requested listing.', 409)
  }
  const edits = req.body?.sections
  const editKeys = ['nutrition', 'allergens', 'dietary', 'selling', 'delivery']
  if (!edits || typeof edits !== 'object' || Array.isArray(edits) ||
      !Object.keys(edits).length || Object.keys(edits).some((key) => !editKeys.includes(key))) {
    problem('Only Food facts & allergens and Selling & delivery can be updated here.')
  }
  if (JSON.stringify(edits).length > 40_000) problem('Food facts or selling updates exceed the permitted size.')
  const updatedCandidate = { ...record.packet }
  for (const key of editKeys) {
    if (Object.prototype.hasOwnProperty.call(edits, key)) updatedCandidate[key] = edits[key]
  }
  // Full validation makes sure the revised listing is still eligible for review.
  const normalized = cleanIncoming(updatedCandidate, record.workspaceType, true)
  // Keep all identity, photo, video, ingredient and step data EXACTLY as they were.
  const safePacket = { ...record.packet }
  for (const key of editKeys) safePacket[key] = normalized[key]
  const previousStatus = record.status
  const now = new Date()
  record.packet = safePacket
  record.status = 'submitted_for_review'
  record.submittedAt = now
  record.approvedAt = null
  record.reviewedAt = null
  record.reviewedByUserId = null
  record.correctionSection = ''
  record.reviewNote = ''
  record.reviewHistory.push({
    decision: 'submitted_for_review', actorUserId: actor(req), at: now,
    note: `Host updated food facts / selling details from ${previousStatus}.`,
  })
  await record.save()
  await notifyActiveSuperAdminsBestEffort({
    triggerType: 'host_unified_listing_submitted', reasonCode: 'host_unified_listing_submission',
    explanation: `Host updated food facts / selling details for ${record.title || 'a listing'}; Super Admin review is required.`,
    relatedEntityType: 'host_unified_listing', relatedEntityId: String(record.id),
    sourceDomain: 'host_operations', sourceVersion: `host-unified-v${record.reviewRevision + 1}`,
    dedupeScope: `host-unified-section-revision:${record.id}:${record.reviewHistory.length}`,
  })
  respond(res, { listing: serialize(record) })
}))

// Host may remove any OWN listing. Keep review history and the database record
// intact, while hiding it from Host history, discovery and active admin queues.
router.delete('/host/listing-packets/:id', ...writeSecurity, wrap(async (req, res) => {
  if (!objectId(req.params.id)) problem('Invalid listing identifier.')
  const record = await HostUnifiedListingPacket.findOneAndUpdate(
    { _id: req.params.id, ownerUserId: actor(req), deletedAt: null },
    { $set: { deletedAt: new Date(), deletedByUserId: actor(req) } },
    { new: true, runValidators: true },
  )
  if (!record) problem('Listing not found in this Host workspace.', 404)
  respond(res, { id: String(record.id), removed: true })
}))
router.post('/host/listing-packets/:id/submit', ...writeSecurity, wrap(async (req, res) => {
  const record = await ownedRecord(req)
  if (!['draft', 'changes_requested'].includes(record.status)) problem('This listing has already been submitted.', 409)
  const packet = cleanIncoming(record.packet, record.workspaceType, true)
  record.packet = packet
  record.status = 'submitted_for_review'
  record.submittedAt = new Date()
  record.reviewNote = ''
  record.correctionSection = ''
  record.reviewHistory.push({ decision: 'submitted_for_review', actorUserId: actor(req), at: new Date() })
  await record.save()
  await notifyActiveSuperAdminsBestEffort({
    triggerType: 'host_unified_listing_submitted', reasonCode: 'host_unified_listing_submission',
    explanation: `Host submitted ${record.title || 'a listing'} for review.`,
    relatedEntityType: 'host_unified_listing', relatedEntityId: String(record.id),
    sourceDomain: 'host_operations', sourceVersion: `host-unified-v${record.reviewRevision + 1}`,
    dedupeScope: `host-unified-submit:${record.id}:${record.reviewRevision + 1}`,
  })
  respond(res, { listing: serialize(record) })
}))
router.post('/host/listing-packets/bulk', ...writeSecurity, wrap(async (req, res) => {
  const { ownerUserId, workspaceType } = context(req)
  const raw = req.body?.packets
  if (!Array.isArray(raw) || !raw.length || raw.length > 25) problem('Import between 1 and 25 food listings per batch.')
  const packets = raw.map((item) => cleanIncoming(item, workspaceType))
  const bulkBatchId = `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const records = await HostUnifiedListingPacket.insertMany(packets.map((packet) => ({
    ownerUserId, workspaceType, type: packet.type, title: packet.title, packet, bulkBatchId,
  })), { ordered: true })
  respond(res, { listings: records.map(serialize), bulkBatchId }, 201)
}))
// Admin queue. Root Super Admin is required for all decisions, with existing
// admin MFA, CSRF, anti-impersonation and active-session middleware preserved.
router.get('/admin/host-listing-packets', ...adminSecurity, superAdminOnly, wrap(async (req, res) => {
  const filter = ['submitted_for_review', 'changes_requested', 'approved', 'rejected'].includes(req.query.status)
    ? { status: req.query.status } : { status: { $ne: 'draft' } }
  filter.deletedAt = null
  const rows = await HostUnifiedListingPacket.find(filter).sort({ submittedAt: -1 }).limit(150)
  respond(res, { listings: rows.map(serialize) })
}))
router.get('/admin/host-listing-packets/:id', ...adminSecurity, superAdminOnly, wrap(async (req, res) => {
  if (!objectId(req.params.id)) problem('Invalid listing identifier.')
  const record = await HostUnifiedListingPacket.findOne({ _id: req.params.id, deletedAt: null })
  if (!record) problem('Listing not found.', 404)
  respond(res, { listing: serialize(record) })
}))
router.post('/admin/host-listing-packets/:id/decision', ...adminWrite, superAdminOnly, wrap(async (req, res) => {
  if (!objectId(req.params.id)) problem('Invalid listing identifier.')
  const decision = String(req.body?.decision || '')
  const note = String(req.body?.note || '').trim().slice(0, 1500)
  const section = String(req.body?.section || '').trim()
  if (!['approved', 'changes_requested', 'rejected'].includes(decision)) problem('Choose a valid review decision.')
  if (decision !== 'approved' && note.length < 5) problem('Explain what needs changing or why this listing was rejected.')
  if (section && !SECTIONS.has(section)) problem('Choose a valid correction section.')
  const now = new Date()
  // Conditional update makes a decision atomic; a second reviewer cannot silently overwrite it.
  const record = await HostUnifiedListingPacket.findOneAndUpdate(
    { _id: req.params.id, status: 'submitted_for_review', deletedAt: null },
    { $set: { status: decision, reviewedAt: now, reviewedByUserId: actor(req),
        reviewNote: note, correctionSection: decision === 'changes_requested' ? section : '',
        ...(decision === 'approved' ? { approvedAt: now } : {}) },
      $inc: { reviewRevision: 1 },
      $push: { reviewHistory: { decision, actorUserId: actor(req), note,
        section: decision === 'changes_requested' ? section : '', at: now } } },
    { new: true, runValidators: true },
  )
  if (!record) problem('Only a submitted listing can be reviewed. Refresh the queue.', 409)
  await createNotificationIntentBestEffort({
    userId: record.ownerUserId, category: 'operations', triggerType: 'host_unified_listing_review',
    reasonCode: `host_unified_listing_${decision}`,
    explanation: decision === 'approved' ? `${record.title} was approved. ${note}`.trim() :
      `${record.title}: ${decision === 'changes_requested' ? 'changes requested' : 'not approved'}. ${note}`,
    relatedEntityType: 'host_unified_listing', relatedEntityId: String(record.id),
    sourceDomain: 'host_operations', sourceVersion: `host-unified-review-v${record.reviewRevision}`,
    actions: ['dismiss'], requestedChannels: ['in_app'],
    dedupeKey: `host-unified-decision:${record.id}:${record.reviewRevision}`,
  })
  respond(res, { listing: serialize(record) })
}))

// Public read model: only Super-Admin-approved packets, no private cost, stock,
// Host service area, raw evidence notes or unrelated draft data is returned.
router.get('/public/host-listings', wrap(async (req, res) => {
  const category = String(req.query?.category || '').trim().toLowerCase()
  const type = String(req.query?.type || '').trim().toLowerCase()
  const filter = { status: 'approved', deletedAt: null }
  if (category) filter['packet.category'] = category
  if (type) filter.type = type
  const rows = await HostUnifiedListingPacket.find(filter).sort({ approvedAt: -1 }).limit(100).lean()
  respond(res, { listings: rows.map(publicListing) })
}))
// Return only the match for the requested PIN, never the Host's full private
// service-area list. Approved Host packets are not verified Marketplace offers.
router.get('/public/host-listings/:id/pincode-quote', wrap(async (req, res) => {
  if (!objectId(req.params.id)) problem('Invalid listing identifier.')
  const pincode = String(req.query?.pincode || '').trim()
  if (!/^[1-9][0-9]{5}$/.test(pincode)) problem('Enter a valid six-digit PIN code.')
  const record = await HostUnifiedListingPacket.findOne({
    _id: req.params.id, type: 'grocery', status: 'approved', deletedAt: null,
  }).select('packet.selling.salePrice packet.delivery.fulfillment packet.delivery.postalCodes').lean()
  if (!record) problem('This approved grocery listing is unavailable.', 404)
  const delivery = record.packet?.delivery || {}
  const pickupOnly = delivery.fulfillment === 'pickup'
  const declaredCoverage = !pickupOnly && (delivery.postalCodes || []).some(code => String(code).trim() === pincode)
  const rawPrice = record.packet?.selling?.salePrice
  const declaredPrice = rawPrice !== null && rawPrice !== undefined && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0 ? Number(rawPrice) : null
  respond(res, { pincode, declaredCoverage, pickupOnly,
    declaredPrice: declaredCoverage ? declaredPrice : null,
    priceSource: 'host_declared_unverified', purchasable: false })
}))

router.get('/public/host-listings/:id', wrap(async (req, res) => {
  if (!objectId(req.params.id)) problem('Invalid listing identifier.')
  const record = await HostUnifiedListingPacket.findOne({ _id: req.params.id, status: 'approved', deletedAt: null }).lean()
  if (!record) problem('This approved listing is unavailable.', 404)
  respond(res, { listing: publicListing(record) })
}))
export default router
