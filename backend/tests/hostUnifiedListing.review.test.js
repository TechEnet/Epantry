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
