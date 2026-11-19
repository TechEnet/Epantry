// Scoped erasure after verified privacy request and administrator retention review.
// Never cascades account deletion, invoices, Host KYB or transaction/audit records.
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { ApiError } from '../../utils/ApiError.js'
import { PrivacyRightsRequest } from './hardening.models.js'
import { DeliveryAddress } from '../deliveryAddresses/deliveryAddress.models.js'
import { CustomerBookmark } from '../bookmarks/bookmark.model.js'
import { UserPreference } from '../users/userPreference.model.js'

function deny(message) { throw new ApiError(409, message) }
export async function executeEligiblePrivacyErasure({ privacyRequestId, actorUser, reason }) {
  const adminId = actorUser?._id
  if (!adminId) throw new ApiError(401, 'Verified administrative session is required.')
  let response
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const request = await PrivacyRightsRequest.findById(privacyRequestId).session(session)
      if (!request || request.requestType !== 'deletion') deny('A valid erasure request is required.')
      if (request.status !== 'processing' || request.identityVerificationStatus !== 'verified') {
        deny('Identity verified and processing status are required before data erasure.')
      }
      if (request.retentionDecision === 'not_reviewed') deny('Document retention and legal holds before erasure.')
      if (request.scopedErasureRunRef) deny('This personal-data cleanup was already executed. Review previous evidence.')
      const owner = request.userId
      const addresses = await DeliveryAddress.deleteMany({ userId: owner }, { session })
      const bookmarks = await CustomerBookmark.deleteMany({ userId: owner }, { session })
      const preferences = await UserPreference.deleteMany({ userId: owner }, { session })
      const counts = { addresses: addresses.deletedCount, savedContent: bookmarks.deletedCount,
        preferences: preferences.deletedCount }
      const ref = `gdpr-erasure-${crypto.randomUUID()}`
      request.scopedErasureRunRef = ref
      request.scopedErasureByUserId = adminId
      request.scopedErasureAt = new Date()
      request.scopedErasureReason = reason
      request.scopedErasureCounts = counts
      request.fulfilmentChecklist = [
        { dataClass: 'addresses', disposition: 'erased', evidenceRef: ref, note: `${counts.addresses} records deleted` },
        { dataClass: 'saved_content', disposition: 'erased', evidenceRef: ref, note: `${counts.savedContent} records deleted` },
        { dataClass: 'preferences', disposition: 'erased', evidenceRef: ref, note: `${counts.preferences} records deleted` },
        ...(request.fulfilmentChecklist || []).filter(item => !['addresses','saved_content','preferences'].includes(item.dataClass)),
      ]
      await request.save({ session })
      response = { requestId: request.requestId, evidenceRef: ref, counts,
        retainedForReview: ['account_profile', 'orders_payments', 'host_business', 'consents',
          'logs_security', 'external_processors'] }
    }, { readPreference: 'primary', writeConcern: { w: 'majority' } })
  } finally { await session.endSession() }
  // The immutable request itself stores the executed erasure reference and counts.
  // Other classes require separate legal-hold / processor fulfilment review.
  return response
}
