import test from 'node:test'
import assert from 'node:assert/strict'
import { publicListing, publicHostListingFilter, publishedHostRecord } from '../src/modules/hostOperations/hostUnifiedListing.public.js'

const baseRecord = {
  _id: '507f1f77bcf86cd799439011', title: 'Test Pastry', type: 'prepared_food',
  approvedAt: new Date('2026-10-22T09:00:00Z'),
  packet: {
    category: 'bakery', description: 'Test', images: ['https://example.com/dish.png'],
    ingredients: [{ name: 'Flour', quantity: 200, unit: 'g', unitPrice: 40, priceQuantity: 1000, imageUrl: 'https://example.com/flour.png', canonicalIngredientId: 'private-id' }],
    shareRecipe: true, sellReadyMade: true, steps: [{ instruction: 'Mix', timerMinutes: 4 }],
    selling: { salePrice: 350, stockQuantity: 50 },
    delivery: { postalCodes: ['110001'], note: 'Personal note' },
    nutrition: { energyKcal: 120, evidenceNote: 'Private provenance' },
    allergens: [{ key: 'wheat', relationship: 'contains' }], dietary: 'vegetarian',
    sourceNotes: 'Private Host notes',
  },
}
test('approved-listing projection never leaks host costing, stock, delivery or source notes', () => {
  const result = publicListing(baseRecord)
  const json = JSON.stringify(result)
  for (const secret of ['unitPrice','priceQuantity','canonicalIngredientId','stockQuantity','postalCodes','Private provenance','Private Host notes','Personal note']) {
    assert.equal(json.includes(secret), false, `Leaked ${secret}`)
  }
  assert.equal(result.offer.purchasable, false)
  assert.equal(result.offer.declaredPrice, 350)
  assert.equal(result.foodEvidenceStatus, 'host_declared_unverified')
  assert.equal(result.ingredients[0].imageUrl, 'https://example.com/flour.png')
})
test('recipe-only listings never expose purchase buttons or prep steps when not shared', () => {
  const result = publicListing({ ...baseRecord, type: 'brand_recipe', packet: { ...baseRecord.packet, sellReadyMade: false, shareRecipe: false } })
  assert.equal(result.offer, null)
  assert.deepEqual(result.steps, [])
  assert.deepEqual(result.ingredients, [])
  assert.equal(result.baseServings, null)
})
test('empty nutrition and missing pricing remain unknown, not fabricated', () => {
  const result = publicListing({ ...baseRecord, packet: { ...baseRecord.packet, selling: {}, nutrition: null } })
  assert.equal(result.nutrition, null)
  assert.equal(result.offer.declaredPrice, null)
})

test('pending Host revisions cannot replace the last approved public version', () => {
  const result = publicListing({ ...baseRecord, status: 'submitted_for_review',
    title: 'Unreviewed new title', packet: { ...baseRecord.packet, description: 'Unreviewed sensitive text' },
    publishedTitle: 'Previously approved title', publishedType: 'prepared_food',
    publishedPacket: { ...baseRecord.packet, description: 'Last reviewed description' },
  })
  assert.equal(result.title, 'Previously approved title')
  assert.equal(result.description, 'Last reviewed description')
  assert.equal(JSON.stringify(result).includes('Unreviewed sensitive text'), false)
})
test('verified canonical Pack IDs are the only identifiers exposed for marketplace eligibility', () => {
  const unpublished = publicListing(baseRecord)
  assert.equal(unpublished.canonicalPackId, null)
  const verified = publicListing({ ...baseRecord, verifiedPackId: '507f1f77bcf86cd799439012' })
  assert.equal(verified.canonicalPackId, '507f1f77bcf86cd799439012')
})

test('approved snapshot remains visible while Host revision changes its status', () => {
  const filter = publicHostListingFilter({ _id: baseRecord._id })
  assert.equal(filter.deletedAt, null)
  assert.deepEqual(filter.$or, [
    { status: 'approved' }, { publishedPacket: { $exists: true, $ne: null } },
  ])
  const version = publishedHostRecord({ ...baseRecord, status: 'rejected',
    title: 'Unapproved title',
    publishedPacket: { ...baseRecord.packet, title: 'Reviewed title' },
    publishedTitle: 'Reviewed title', publishedType: 'prepared_food',
  })
  assert.equal(version.status, 'approved')
  assert.equal(version.title, 'Reviewed title')
  assert.equal(version.packet.title, 'Reviewed title')
})

test('prepared item can show dietary and allergen data without sharing its private recipe', () => {
  const result = publicListing({ ...baseRecord, packet: { ...baseRecord.packet, shareRecipe: false } })
  assert.deepEqual(result.ingredients, [])
  assert.deepEqual(result.steps, [])
  assert.deepEqual(result.allergens, [{ key: 'wheat', relationship: 'contains' }])
  assert.equal(result.offer.purchasable, false)
})


test('Only a verified catalog match exposes a canonical product purchase path', () => {
  const unverified = publicListing(baseRecord)
  assert.equal(unverified.marketplaceProductPath, null)
  const linked = publicListing({ ...baseRecord,
    verifiedPackId: '507f1f77bcf86cd799439012',
    verifiedProductPath: '/grocery/product/published--variant--pack' })
  assert.equal(linked.marketplaceProductPath, '/grocery/product/published--variant--pack')
  assert.equal(linked.offer.purchasable, false)
})


test('post-approval catalog linking uses Super Admin write guards and never directly publishes a product', async () => {
  const fs = await import('node:fs')
  const routes = fs.readFileSync(new URL('../src/modules/hostOperations/hostUnifiedListing.routes.js', import.meta.url), 'utf8')
  const start = routes.indexOf("router.post('/admin/host-listing-packets/:id/link-catalog'")
  const end = routes.indexOf("router.post('/admin/host-listing-packets/:id/decision'", start)
  assert.ok(start > 0 && end > start)
  const code = routes.slice(start, end)
  assert.match(code, /\.\.\.adminWrite, superAdminOnly/)
  assert.match(code, /await validateCatalogMatch\(packet\)/)
  assert.match(code, /publishedPacket: packet/)
  assert.doesNotMatch(code, /publishProductVersion\(|createProductPack\(|HostOffer\.create\(/)
})

test('old Host listing data is retained during sidebar consolidation', async () => {
  const fs = await import('node:fs')
  const ui = fs.readFileSync(new URL('../../frontend/src/features/host/components/HostShell.jsx', import.meta.url), 'utf8')
  const model = fs.readFileSync(new URL('../src/modules/hostOperations/hostUnifiedListing.models.js', import.meta.url), 'utf8')
  assert.doesNotMatch(ui, /label: "Add \/ Edit Products"|label: "Recipe Listings"/)
  assert.match(model, /collection: 'hostUnifiedListingPackets'/)
  assert.match(model, /publishedPacket/)
})

test('Host selling setup is available only after governed publication and is never a direct status mutation', async () => {
  const fs = await import('node:fs')
  const routes = fs.readFileSync(new URL('../src/modules/hostOperations/hostUnifiedListing.routes.js', import.meta.url), 'utf8')
  const start = routes.indexOf("router.get('/host/listing-packets/:id/selling-readiness'")
  const end = routes.indexOf("router.post('/host/listing-packets'", start)
  assert.ok(start > 0 && end > start)
  const code = routes.slice(start, end)
  assert.match(code, /\.\.\.readSecurity/)
  assert.match(code, /ownedRecord\(req\)/)
  assert.match(code, /resolveRecordPublishedCatalog\(record\.toObject\(\)\)/)
  assert.match(code, /readiness\.packId = packId/)
  assert.match(code, /readiness\.offerId = String\(offer\._id\)/)
  assert.doesNotMatch(code, /HostOffer\.create|HostOffer\.update/)
})

test('The listing editor uses protected Marketplace APIs for live selling; legacy records remain accessible', async () => {
  const fs = await import('node:fs')
  const ui = fs.readFileSync(new URL('../../frontend/src/features/host/pages/HostUnifiedListingPage.jsx', import.meta.url), 'utf8')
  const client = fs.readFileSync(new URL('../../frontend/src/features/marketplace/services/marketplace.service.js', import.meta.url), 'utf8')
  for (const action of ['createHostOffer', 'createHostPriceRule', 'createInventorySnapshots', 'createServiceArea', 'activateHostOffer']) {
    assert.match(ui, new RegExp(`\\b${action}\\(`))
    assert.match(client, new RegExp(`export async function ${action}\\(`))
  }
  assert.match(ui, /readiness\?\.approved && readiness\?\.catalogLinked && readiness\?\.packId/)
  assert.match(ui, /PreviouslyListedItems/)
  assert.match(ui, /listHostNpiDrafts/)
  assert.match(ui, /listHostRecipeListingHistory/)
  assert.doesNotMatch(ui, /ProductVersion\.create|status: ['"]active['"],\s*createdByUserId/)
})


test('new product catalog handoff requires an approved NPI record from the same Host and stays in catalog review', async () => {
  const fs = await import('node:fs')
  const routes = fs.readFileSync(new URL('../src/modules/hostOperations/hostUnifiedListing.routes.js', import.meta.url), 'utf8')
  const model = fs.readFileSync(new URL('../src/modules/hostOperations/hostUnifiedListing.models.js', import.meta.url), 'utf8')
  const start = routes.indexOf("router.post('/admin/host-listing-packets/:id/catalog-draft'")
  const end = routes.indexOf("router.post('/admin/host-listing-packets/:id/decision'", start)
  assert.ok(start > 0 && end > start)
  const code = routes.slice(start, end)
  assert.match(code, /adminWrite, superAdminOnly/)
  assert.match(code, /createdByUserId: record.ownerUserId/)
  assert.match(code, /organizationId: organization._id/)
  assert.match(code, /status: 'approved_for_catalog', readyForCatalog: true/)
  assert.match(code, /materializeNpiDraftToCatalog/)
  assert.match(code, /catalogReviewRequired: true/)
  assert.doesNotMatch(code, /ProductVersion\.create|publicationStatus: 'published'|HostOffer\.create/)
  assert.match(model, /catalogNpiDraftId/)
  assert.match(routes, /return resolvePublishedCatalog\(\{ \.\.\.approved\.packet/)
})

test('previous Host editor routes now open the one Studio without deleting legacy records', async () => {
  const fs = await import('node:fs')
  const routes = fs.readFileSync(new URL('../../frontend/src/routes/AppRoutes.jsx', import.meta.url), 'utf8')
  const studio = fs.readFileSync(new URL('../../frontend/src/features/host/pages/HostUnifiedListingPage.jsx', import.meta.url), 'utf8')
  assert.match(routes, /to="\/host\/listings\/new\?manage=product-evidence"/)
  assert.match(routes, /to="\/host\/listings\/new\?manage=kitchen-recipes"/)
  assert.match(studio, /ProductEvidenceWorkspace/)
  assert.match(studio, /BrandRecipeHistoryWorkspace/)
  assert.match(studio, /KitchenRecipeHistoryWorkspace/)
  assert.match(studio, /PreviouslyListedItems/)
})
