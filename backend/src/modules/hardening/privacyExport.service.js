// M1: owner-bound, allow-listed JSON export. Never export auth tokens, hashes or another user's records.
import { ApiError } from '../../utils/ApiError.js'
import { User } from '../users/user.model.js'
import { UserPreference } from '../users/userPreference.model.js'
import { UserConsent } from '../users/userConsent.model.js'
import { CookieConsent } from '../cookieConsent/cookieConsent.model.js'
import { ParentOrder } from '../commerce/commerce.transaction.models.js'
import { DeliveryAddress } from '../deliveryAddresses/deliveryAddress.models.js'
import { CustomerBookmark } from '../bookmarks/bookmark.model.js'
import { HostUnifiedListingPacket } from '../hostOperations/hostUnifiedListing.models.js'
import { PrivacyRightsRequest } from './hardening.models.js'

function stringId(value) { return String(value?._id || value?.id || value || '') }

export async function getApprovedOwnPrivacyExport({ actorUser, requestObjectId }) {
  const ownerId = stringId(actorUser)
  if (!ownerId) throw new ApiError(401, 'Authentication required.')
  const request = await PrivacyRightsRequest.findOne({
    _id: requestObjectId, userId: ownerId, requestType: 'access_export',
    status: 'completed', exportArtifactStatus: 'available', identityVerificationStatus: 'verified',
  }).lean()
  if (!request) throw new ApiError(404, 'Approved export is not available for this account.')
  const [user, preferences, consent, cookie, orders, requests, addresses, bookmarks, hostListings] = await Promise.all([
    User.findById(ownerId).select('name email phone profilePhotoUrl emailVerified phoneVerified accountStatus customerEnabled hostEnabled hostAccessStatus hostWorkspaceType createdAt updatedAt').lean(),
    UserPreference.findOne({ userId: ownerId }).select('dietaryLifestyles allergens preferredCuisines dislikedIngredients measurementSystem locale personalizationEnabled createdAt updatedAt').lean(),
    UserConsent.find({ userId: ownerId }).select('consentType decision version source createdAt').sort({ createdAt: -1 }).limit(500).lean(),
    CookieConsent.findOne({ subjectKey: `user:${actorUser.firebaseUid}` }).select('policyVersion preferences analytics decidedAt revisions').lean(),
    ParentOrder.find({ ownerUserId: ownerId }).select('status paymentStatus totals sourceType createdAt updatedAt').sort({ createdAt: -1 }).limit(1000).lean(),
    PrivacyRightsRequest.find({ userId: ownerId }).select('requestId requestType scope requestedAt dueAt status completedAt').sort({ requestedAt: -1 }).limit(500).lean(),
    DeliveryAddress.find({ userId: ownerId }).select('recipientType recipientName phone label customLabel addressLine1 addressLine2 city state postalCode country landmark isDefault deliveryInstructions createdAt updatedAt').sort({ createdAt: -1 }).limit(1000).lean(),
    CustomerBookmark.find({ userId: ownerId }).select('kind slug title subtitle sourceType sourceId createdAt updatedAt').sort({ createdAt: -1 }).limit(1000).lean(),
    HostUnifiedListingPacket.find({ ownerUserId: ownerId }).select('title type status submittedAt approvedAt reviewHistory moderationStatus createdAt updatedAt').sort({ createdAt: -1 }).limit(500).lean(),
  ])
  if (!user) throw new ApiError(404, 'Account not found.')
  return {
    format: 'epantry-privacy-export-v1', generatedAt: new Date().toISOString(),
    requestReference: request.requestId, account: user, preferences,
    consentHistory: consent, cookiePreferences: cookie,
    orderSummaries: orders, privacyRequests: requests,
    deliveryAddresses: addresses, savedBookmarks: bookmarks, hostListingSummaries: hostListings,
    exportLimits: { orders: 1000, addresses: 1000, bookmarks: 1000, hostListings: 500, consentHistory: 500 },
    exportMayBeTruncated: orders.length >= 1000 || addresses.length >= 1000 || bookmarks.length >= 1000 || hostListings.length >= 500 || consent.length >= 500,
    // Other linked business records and external processor data require separate fulfilment review.
    exportScope: 'EPANTRY account, addresses, saved bookmarks, Host listing summaries, preferences, consent and order summaries',
    otherDataReviewRequired: true,
  }
}
