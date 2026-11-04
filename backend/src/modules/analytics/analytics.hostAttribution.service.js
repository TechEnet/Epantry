/*
 * Verified Host attribution for observational analytics.
 *
 * Never trust a viewer-supplied organization identifier. Resolve attribution
 * only from saved, server-owned business records; unresolved events remain
 * unattributed. Analytics failures never affect customer operations.
 */
import { Dish } from '../recipes/recipe.models.js'
import { HostUnifiedListingPacket } from '../hostOperations/hostUnifiedListing.models.js'
import { publicHostListingFilter, publicHostSlug, publishedHostRecord } from '../hostOperations/hostUnifiedListing.public.js'
import { MarketplaceOrganization } from '../marketplace/marketplace.models.js'
import { MarketplaceCart } from '../commerce/commerce.models.js'
import { SellerOrder } from '../commerce/commerce.transaction.models.js'
import { Campaign } from '../retailMedia/retailMedia.models.js'

const OBJECT_ID = /^[a-f\d]{24}$/i
const str = (value) => String(value || '').trim()

async function activeOrganizationForOwner(ownerUserId) {
  if (!ownerUserId) return null
  const org = await MarketplaceOrganization.findOne({
    ownerUserId,
    status: 'active',
  }).select('_id').lean()
  return org?._id || null
}

// Resolve only the *published* public identity; a pending revision does not
// count as an available listing or a different business.
export async function organizationForPublicListingPath(pathname) {
  const byId = pathname.match(/^\/api\/v1\/public\/host-listings\/([a-f\d]{24})$/i)
  const bySlug = pathname.match(/^\/api\/v1\/public\/host-listings\/by-slug\/([^/]+)$/)
  if (!byId && !bySlug) return null

  let listing = null
  if (byId) {
    listing = await HostUnifiedListingPacket.findOne(
      publicHostListingFilter({ _id: byId[1] }),
    ).select('_id ownerUserId type publishedType packet publishedPacket').lean()
  } else {
    const slug = decodeURIComponent(bySlug[1]).trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{1,199}$/.test(slug)) return null
    listing = await HostUnifiedListingPacket.findOne(
      publicHostListingFilter({ publicSlug: slug }),
    ).select('_id ownerUserId type publishedType packet publishedPacket').lean()
    if (!listing) {
      // The public route also supports legacy approved listings without a
      // persisted slug. Mirror its bounded compatibility lookup.
      const older = await HostUnifiedListingPacket.find({
        ...publicHostListingFilter(),
        $and: [{ $or: [{ publicSlug: { $exists: false } }, { publicSlug: null }] }],
      }).select('_id ownerUserId title type publishedType packet publishedPacket publicSlug').sort({ approvedAt: -1 }).limit(300).lean()
      listing = older.find((row) => publicHostSlug(row) === slug) || null
    }
  }
  if (!listing) return null
  const published = publishedHostRecord(listing)
  return {
    organizationId: await activeOrganizationForOwner(listing.ownerUserId),
    listingId: str(listing._id),
    isRecipe: ['kitchen_recipe', 'brand_recipe'].includes(published.type),
  }
}

// Public recipe reads and successful outcome/cooked routes already enforce
// publication. The Dish creator is the only verifiable attribution link in
// the current canonical recipe model; unrelated Super Admin recipes remain
// unattributed when no active Host organization exists.
export async function organizationForPublishedRecipe(reference) {
  const key = str(reference)
  if (!key || key.length > 220) return null
  const filter = OBJECT_ID.test(key) ? { _id: key } : { slug: key.toLowerCase() }
  const dish = await Dish.findOne({ ...filter, status: 'active' })
    .select('_id createdByUserId').lean()
  if (!dish) return null
  return {
    organizationId: await activeOrganizationForOwner(dish.createdByUserId),
    dishId: str(dish._id),
  }
}

// The cart was validated and persisted by commerce before this is called.
// A multi-seller cart legitimately counts once for each distinct Host, not
// once for each item or repeated idempotent request.
export async function organizationsForSavedCart({ actorUser, idempotencyKey }) {
  const userId = actorUser?._id || actorUser?.id
  if (!userId || !str(idempotencyKey)) return []
  const cart = await MarketplaceCart.findOne({
    ownerUserId: userId,
    createIdempotencyKey: idempotencyKey,
  }).select('_id items.organizationId items.offerId').lean()
  if (!cart) return []
  const unique = [...new Set((cart.items || [])
    .map((item) => str(item.organizationId))
    .filter((value) => OBJECT_ID.test(value)))]
  if (!unique.length) return []
  const valid = await MarketplaceOrganization.find({
    _id: { $in: unique }, status: 'active',
  }).select('_id').lean()
  return valid.map((org) => ({
    organizationId: org._id,
    cartId: str(cart._id),
    lineCount: (cart.items || []).filter((item) =>
      str(item.organizationId) === str(org._id)).length,
  }))
}

export async function organizationForNotification(notification) {
  const kind = str(notification?.relatedEntityType)
  const entityId = str(notification?.relatedEntityId)
  if (!OBJECT_ID.test(entityId)) return null
  if (kind === 'host_seller_order') {
    const order = await SellerOrder.findById(entityId)
      .select('organizationId').lean()
    return order?.organizationId || null
  }
  if (kind === 'retail_media_campaign') {
    const campaign = await Campaign.findById(entityId)
      .select('organizationId').lean()
    return campaign?.organizationId || null
  }
  if (kind === 'host_unified_listing') {
    const listing = await HostUnifiedListingPacket.findById(entityId)
      .select('ownerUserId').lean()
    return activeOrganizationForOwner(listing?.ownerUserId)
  }
  return null
}

export async function safeHostAttribution(resolve) {
  try { return await resolve() } catch { return null }
}
