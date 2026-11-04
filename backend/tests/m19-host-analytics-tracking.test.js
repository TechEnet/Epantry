import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const ID_A = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const ID_B = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const ID_C = 'cccccccccccccccccccccccc'
const USER = 'dddddddddddddddddddddddd'
const DISH = 'eeeeeeeeeeeeeeeeeeeeeeee'

function query(result) {
  return {
    select() { return this },
    sort() { return this },
    limit() { return this },
    lean: async () => result,
  }
}

function helpers({
  listing = null,
  dish = null,
  org = null,
  orgs = [],
  cart = null,
  sellerOrder = null,
  campaign = null,
} = {}) {
  const calls = []
  const models = {
    Dish: {
      findOne: (filter) => { calls.push(['dish', filter]); return query(dish) },
    },
    HostUnifiedListingPacket: {
      findOne: (filter) => { calls.push(['listing', filter]); return query(listing) },
      find: () => query([]),
      findById: () => query(listing),
    },
    MarketplaceOrganization: {
      findOne: (filter) => { calls.push(['org', filter]); return query(org) },
      find: (filter) => { calls.push(['orgs', filter]); return query(orgs) },
    },
    MarketplaceCart: {
      findOne: (filter) => { calls.push(['cart', filter]); return query(cart) },
    },
    SellerOrder: {
      findById: () => query(sellerOrder),
    },
    Campaign: {
      findById: () => query(campaign),
    },
    publicHostListingFilter: (filter = {}) => ({
      ...filter,
      deletedAt: null,
      $or: [{ status: 'approved' }, { publishedPacket: { $exists: true, $ne: null } }],
    }),
    publicHostSlug: (record) => record.publicSlug,
    publishedHostRecord: (record) => record.publishedPacket
      ? { ...record, type: record.publishedType || record.type, packet: record.publishedPacket }
      : record,
  }
  // Evaluate the implementation with injected model doubles. This tests the
  // real resolver logic without requiring a database or live credentials.
  const source = read('src/modules/analytics/analytics.hostAttribution.service.js')
    .replace(/^import .*\n/gm, '')
    .replace(/^export /gm, '')
  const names = Object.keys(models)
  const values = Object.values(models)
  const api = new Function(...names, `${source}\nreturn { organizationForPublicListingPath, organizationForPublishedRecipe, organizationsForSavedCart, organizationForNotification, safeHostAttribution }`)(...values)
  return { ...api, calls }
}

test('approved public Host recipe view resolves only its persisted owner and approved identity', async () => {
  const h = helpers({
    listing: {
      _id: ID_A, ownerUserId: USER, type: 'kitchen_recipe',
      publicSlug: 'real-food', status: 'approved', packet: { shareRecipe: true },
    },
    org: { _id: ID_B },
  })
  const result = await h.organizationForPublicListingPath(`/api/v1/public/host-listings/${ID_A}`)
  assert.equal(result.listingId, ID_A)
  assert.equal(result.organizationId, ID_B)
  assert.equal(result.isRecipe, true)
  assert.equal(h.calls[0][1].deletedAt, null)
  assert.ok(h.calls[0][1].$or.some((filter) => filter.status === 'approved'))
  assert.equal(h.calls[1][1].ownerUserId, USER)
  assert.equal(h.calls[1][1].status, 'active')
  assert.equal(await h.organizationForPublicListingPath('/api/v1/public/host-listings'), null)
})

test('canonical recipe attribution requires an active Dish creator-owned Host organization', async () => {
  const h = helpers({ dish: { _id: DISH, createdByUserId: USER }, org: { _id: ID_A } })
  assert.deepEqual(await h.organizationForPublishedRecipe('a-recipe'), {
    organizationId: ID_A, dishId: DISH,
  })
  assert.equal(h.calls[0][1].status, 'active')
  const noOrg = helpers({ dish: { _id: DISH, createdByUserId: USER } })
  assert.equal((await noOrg.organizationForPublishedRecipe('a-recipe')).organizationId, null)
})

test('basket engagement counts each saved cart once per valid seller, not each item', async () => {
  const h = helpers({
    cart: {
      _id: ID_C,
      items: [
        { organizationId: ID_A },
        { organizationId: ID_A },
        { organizationId: ID_B },
      ],
    },
    orgs: [{ _id: ID_A }, { _id: ID_B }],
  })
  const result = await h.organizationsForSavedCart({
    actorUser: { _id: USER }, idempotencyKey: 'trusted-server-key',
  })
  assert.deepEqual(result.map((row) => [row.organizationId, row.lineCount]), [[ID_A, 2], [ID_B, 1]])
  assert.equal(h.calls[0][1].ownerUserId, USER)
  assert.equal(h.calls[0][1].createIdempotencyKey, 'trusted-server-key')
  assert.equal(h.calls[1][1].status, 'active')
  assert.deepEqual(await h.organizationsForSavedCart({ actorUser: { _id: USER } }), [])
})

test('notification ownership comes only from saved related entities', async () => {
  const h = helpers({
    sellerOrder: { organizationId: ID_A },
    campaign: { organizationId: ID_B },
    listing: { ownerUserId: USER },
    org: { _id: ID_C },
  })
  assert.equal(await h.organizationForNotification({ relatedEntityType: 'host_seller_order', relatedEntityId: ID_A }), ID_A)
  assert.equal(await h.organizationForNotification({ relatedEntityType: 'retail_media_campaign', relatedEntityId: ID_A }), ID_B)
  assert.equal(await h.organizationForNotification({ relatedEntityType: 'host_unified_listing', relatedEntityId: ID_A }), ID_C)
  assert.equal(await h.organizationForNotification({ relatedEntityType: 'other', relatedEntityId: ID_A }), null)
  assert.equal(await h.organizationForNotification({ relatedEntityType: 'retail_media_campaign', relatedEntityId: '../unsafe' }), null)
})

test('analytics instrumentation records only successful actions, dedupes cooked/cart and preserves global events', () => {
  const src = read('src/middlewares/analyticsInstrumentation.middleware.js')
  for (const token of [
    "'discovery.listing_viewed'", "'recipe.cooked'",
    "'commerce.host_basket_created'", "'/api/v1/cart/direct'",
    "'/api/v1/cart/restaurant-recipe'", "'idempotency-key'",
    'organizationsForSavedCart', 'organizationForPublishedRecipe',
    'organizationForPublicListingPath', 'recordAnalyticsEventBestEffort',
  ]) assert.ok(src.includes(token), `Missing tracking boundary: ${token}`)
  assert.match(src, /res\.statusCode\s*</)
  assert.match(src, /res\.statusCode\s*>=/)
  assert.match(src, /clientEventId: `hostbasket_/)
  const registry = read('src/modules/analytics/analytics.service.js')
  assert.ok(registry.includes("'commerce.basket_created'"))
  assert.ok(registry.includes("'commerce.host_basket_created'"))
})

test('Host report counts real discovery only and reads Host-scoped baskets', () => {
  const src = read('src/modules/analytics/analytics.batch2.service.js')
  const decision = src.slice(src.indexOf('async function decisionContextCounts'), src.indexOf('function ratio'))
  assert.match(decision, /eventName:\s*\{\s*\$in/)
  assert.ok(decision.includes('discovery.listing_viewed'))
  assert.ok(decision.includes('discovery.sponsored_served'))
  const host = src.slice(src.indexOf('export async function getHostAnalyticsDashboard'), src.indexOf('export async function getAdminAnalyticsDashboard'))
  assert.ok(host.includes('commerce.host_basket_created'))
  assert.ok(host.includes('organizationPseudonym'))
})

test('sponsored and notification events preserve server ownership and event semantics', () => {
  const sponsor = read('src/modules/retailMedia/retailMedia.service.js')
  const start = sponsor.indexOf('export async function decideLowRiskSponsoredPlacement')
  const end = sponsor.indexOf('export async function listAdminAdDecisionLogs', start)
  const section = sponsor.slice(start, end)
  assert.ok(section.indexOf('if (!selected)') < section.indexOf("eventName: 'discovery.sponsored_served'"))
  assert.ok(section.includes('organizationId: selected.campaign.organizationId'))
  const notification = read('src/modules/notifications/notification.service.js')
  assert.equal(notification.match(/organizationForNotification\(/g)?.length, 3)
  assert.ok(notification.includes('safeHostAttribution'))
})
