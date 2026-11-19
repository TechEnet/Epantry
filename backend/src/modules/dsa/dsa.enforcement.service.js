// M4: Governed restriction of one verified Host listing and its selling offer.
// Always use a MongoDB transaction. A report decision alone never hides content.
import mongoose from 'mongoose'
import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'
import { DsaNotice } from './dsa.models.js'
import { HostUnifiedListingPacket } from '../hostOperations/hostUnifiedListing.models.js'
import { HostOffer, MarketplaceOrganization } from '../marketplace/marketplace.models.js'
import { publicHostSlug } from '../hostOperations/hostUnifiedListing.public.js'
import { createNotificationIntentBestEffort } from '../notifications/notification.service.js'

function fail(message, status = 409) { throw new ApiError(status, message) }
function matchListingUrl(url, listing) {
  // Only bind reports to a specific published Host listing, never to a guessed product.
  let path
  try {
    const website = new URL(url, env.frontendUrl)
    const configured = new URL(env.frontendUrl)
    const allowed = new Set([configured.host, 'epantry.in', 'www.epantry.in'])
    if (!allowed.has(website.host) || (website.protocol !== 'https:' && website.origin !== configured.origin)) return false
    path = website.pathname.replace(/\/$/, '')
  } catch { return false }
  const slug = publicHostSlug(listing)
  const id = String(listing._id)
  return path === `/recipes/${slug}` || path === `/grocery/product/${slug}` ||
    path === `/recipes/host--${id}` || path === `/grocery/product/host--${id}` ||
    path === `/explore/host-listings/${slug}` ||
    path === `/explore/host-listings/${id}` ||
    path === `/host-listings/${slug}` || path === `/host-listings/${id}` ||
    path === `/recipes/host/${slug}` || path === `/recipes/host/${id}` ||
    path === `/grocery/host/${slug}` || path === `/grocery/host/${id}` ||
    path === `/public/host-listings/by-slug/${slug}` ||
    path === `/public/host-listings/${id}`
}
export { matchListingUrl }

export async function governReportedHostListing({ reference, listingId, actorUser, reason, action }) {
  if (!mongoose.isValidObjectId(listingId)) fail('Use the exact Host listing ObjectId.', 400)
  if (!['restrict', 'lift'].includes(action)) fail('Invalid enforcement action.', 400)
  const actorId = actorUser?._id
  if (!actorId) fail('Admin identity required.', 401)
  let result
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const notice = await DsaNotice.findOne({ reference }).session(session)
      const listing = await HostUnifiedListingPacket.findOne({ _id: listingId, deletedAt: null }).session(session)
      if (!notice || !listing) fail('Report or Host listing not found.', 404)
      if (notice.status !== 'decision_issued' && notice.status !== 'appeal_decided') {
        fail('A reasoned decision must be issued before enforcing or lifting restrictions.')
      }
      if (action === 'restrict') {
        if (notice.outcome !== 'referred_for_listing_review') fail('A listing-review outcome is required before restricting a Host listing.')
        if (!matchListingUrl(notice.listingUrl, listing)) {
          fail('Report URL does not match this Host listing. Investigate manually; never restrict an unrelated seller.', 409)
        }
        if (listing.moderationStatus === 'restricted' || notice.enforcementStatus === 'restricted') {
          fail('This listing already has an active restriction.')
        }
        listing.moderationStatus = 'restricted'
        listing.moderationReason = reason
        listing.moderationReportReference = reference
        listing.moderatedAt = new Date()
        listing.moderatedByUserId = actorId
        // The Host's active offers are paused inside the SAME transaction.
        // Only the affected seller's offer can be paused, even if a SKU is copied.
        const owningOrg = await MarketplaceOrganization.findOne({
          ownerUserId: listing.ownerUserId, status: 'active',
        }).session(session)
        if (owningOrg) await HostOffer.updateMany({
          organizationId: owningOrg._id, merchantSku: `epantry-${listingId}`, status: 'active',
        }, { $set: { status: 'paused', updatedByUserId: actorId } }, { session })
        notice.enforcementListingId = listing._id
        notice.enforcementStatus = 'restricted'
        notice.enforcedAt = new Date()
        notice.enforcedBy = actorId
        notice.sellerNoticeAttemptedAt = new Date()
        notice.timeline.push({ event: 'listing_restricted', actor: String(actorId), note: reason })
      } else {
        if (notice.enforcementStatus !== 'restricted' || String(notice.enforcementListingId) !== String(listingId) ||
          listing.moderationStatus !== 'restricted' || listing.moderationReportReference !== reference) {
          fail('Only the specific active restriction attached to this report can be lifted.')
        }
        listing.moderationStatus = 'clear'
        listing.moderationReason = ''
        listing.moderationReportReference = ''
        listing.moderatedAt = new Date()
        listing.moderatedByUserId = actorId
        notice.enforcementStatus = 'lifted'
        notice.restrictionLiftedAt = new Date()
        notice.sellerNoticeAttemptedAt = new Date()
        notice.timeline.push({ event: 'restriction_lifted', actor: String(actorId), note: reason })
        // Never reactivate paused commercial offers automatically. Stock and legal
        // eligibility must be explicitly checked in the existing governance UI.
      }
      await listing.save({ session })
      await notice.save({ session })
      result = { reference, action, listingId: String(listing._id), hostUserId: listing.ownerUserId,
        noticeId: String(notice._id), status: notice.enforcementStatus }
    }, { readPreference: 'primary', writeConcern: { w: 'majority' } })
  } finally { await session.endSession() }
  // Delivery is best effort. The database audit records the attempted notification,
  // not an unverified claim that the seller received it.
  await createNotificationIntentBestEffort({
    userId: result.hostUserId, category: 'operations', triggerType: 'host_unified_listing_review',
    reasonCode: action === 'restrict' ? 'dsa_listing_restricted' : 'dsa_listing_restriction_lifted',
    explanation: action === 'restrict'
      ? `Your EPANTRY listing was restricted after Trust & Safety review (${reference}). Reason: ${reason}. Appeal from your Host Notices page.`
      : `Trust & Safety restriction ${reference} was lifted. Your selling offers stay paused until re-approved. Reason: ${reason}`,
    relatedEntityType: 'host_unified_listing', relatedEntityId: result.listingId,
    sourceDomain: 'dsa', sourceVersion: 'dsa-m4', actions: ['dismiss'],
    requestedChannels: ['in_app'], dedupeKey: `dsa-${action}-${reference}-${result.noticeId}`,
  })
  delete result.hostUserId
  return result
}
