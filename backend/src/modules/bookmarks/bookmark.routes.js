import { Router } from 'express'
import { ApiError } from '../../utils/ApiError.js'
import { authenticateSession, loadCurrentUser, requireActiveAccount, requireCsrfToken } from '../auth/auth.middleware.js'
import { requireCustomerAccess } from '../auth/authorization.middleware.js'
import { sensitiveResponseNoStoreMiddleware } from '../../middlewares/security.middleware.js'
import { getPublicRecipe } from '../recipes/recipe.public.service.js'
import { getPublicProductBySlug } from '../catalog/catalog.public.service.js'
import { HostUnifiedListingPacket } from '../hostOperations/hostUnifiedListing.models.js'
import { publicHostSlug } from '../hostOperations/hostUnifiedListing.public.js'
import { CustomerBookmark } from './bookmark.model.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const respond = (res, data) => res.status(200).json({ success: true, data })
const normalize = value => String(value || '').trim().toLowerCase()

function parseKey(source = {}) {
  const kind = normalize(source.kind)
  const slug = normalize(source.slug)
  if (!['recipe', 'grocery'].includes(kind) || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug)) {
    throw new ApiError(400, 'Choose a valid published recipe or grocery item.')
  }
  return { kind, slug }
}

// Resolve against the same public data sources as the detail pages; never let
// a browser invent a product title/image or bookmark a private Host draft.
async function resolvePublishedItem({ kind, slug }) {
  if (kind === 'recipe') {
    try {
      const item = await getPublicRecipe(slug)
      if (item?.dish?.slug) return {
        sourceType: 'canonical',
        sourceId: String(item.dish.id || ''),
        title: item.dish.name,
        imageUrl: item.dish.heroImageUrl || '',
        subtitle: item.dish.cuisine || 'Recipe',
      }
    } catch (error) { if (error?.statusCode !== 404) throw error }
  } else {
    try {
      const item = await getPublicProductBySlug(slug)
      if (item?.slug) return {
        sourceType: 'canonical',
        sourceId: String(item.id || ''),
        title: item.displayName,
        imageUrl: item.image?.url || '',
        subtitle: item.category?.name || 'Grocery',
      }
    } catch (error) { if (error?.statusCode !== 404) throw error }
  }

  // Friendly Host slugs are already shared by approved Host detail pages.
  // Legacy host--<ObjectId> links remain accepted, but drafts are never saved.
  const legacyId = /^host--([a-f0-9]{24})$/.exec(slug)?.[1]
  let listing = legacyId
    ? await HostUnifiedListingPacket.findOne({ _id: legacyId, status: 'approved', deletedAt: null }).lean()
    : await HostUnifiedListingPacket.findOne({ publicSlug: slug, status: 'approved', deletedAt: null }).lean()
  if (!listing && !legacyId) {
    const suffix = slug.match(/-([a-f0-9]{10})$/)?.[1]
    if (suffix) {
      const candidates = await HostUnifiedListingPacket.aggregate([
        { $match: { status: 'approved', deletedAt: null } },
        { $match: { $expr: { $eq: [{ $substrBytes: [{ $toString: '$_id' }, 14, 10] }, suffix] } } },
        { $limit: 10 },
      ])
      listing = candidates.find(item => publicHostSlug(item) === slug) || null
    }
  }
  const typeMatches = listing && (
    kind === 'grocery' ? listing.type === 'grocery' : ['kitchen_recipe', 'prepared_food', 'brand_recipe'].includes(listing.type)
  )
  if (!typeMatches) throw new ApiError(404, 'This item is not currently published on EPANTRY.')
  return {
    sourceType: 'host',
    sourceId: String(listing._id),
    title: listing.title,
    imageUrl: (listing.packet?.images || [])[0] || '',
    subtitle: kind === 'recipe' ? 'Host recipe' : 'Host grocery',
  }
}

router.use(sensitiveResponseNoStoreMiddleware, authenticateSession, loadCurrentUser, requireActiveAccount, requireCustomerAccess)

router.get('/', wrap(async (req, res) => {
  const userId = req.currentUser._id
  const rows = await CustomerBookmark.find({ userId }).sort({ createdAt: -1 }).limit(300).lean()
  const hostIds = rows.filter(item => item.sourceType === 'host' && /^[a-f0-9]{24}$/i.test(item.sourceId || '')).map(item => item.sourceId)
  const approvedHosts = hostIds.length
    ? await HostUnifiedListingPacket.find({ _id: { $in: hostIds }, status: 'approved', deletedAt: null }).select('_id').lean()
    : []
  const approvedIds = new Set(approvedHosts.map(item => String(item._id)))
  // Retain saved records in MongoDB but never expose a Host listing that is
  // deleted or temporarily unpublished while being re-reviewed.
  const visible = rows.filter(item => item.sourceType !== 'host' || approvedIds.has(item.sourceId))
  return respond(res, { items: visible.map(item => ({
    kind: item.kind, slug: item.slug, title: item.title,
    imageUrl: item.imageUrl, subtitle: item.subtitle, savedAt: item.createdAt,
  })) })
}))

router.post('/', requireCsrfToken, wrap(async (req, res) => {
  const key = parseKey(req.body)
  const userId = req.currentUser._id
  const published = await resolvePublishedItem(key)
  const item = await CustomerBookmark.findOneAndUpdate(
    { userId, ...key },
    { $set: published, $setOnInsert: { userId, ...key } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  )
  return respond(res, { item: { kind: item.kind, slug: item.slug, title: item.title, imageUrl: item.imageUrl } })
}))

router.delete('/:kind/:slug', requireCsrfToken, wrap(async (req, res) => {
  const key = parseKey(req.params)
  await CustomerBookmark.deleteOne({ userId: req.currentUser._id, ...key })
  return respond(res, { removed: true, ...key })
}))

export default router
