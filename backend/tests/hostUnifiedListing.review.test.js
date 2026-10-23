import test from 'node:test'
import assert from 'node:assert/strict'
import { publicListing } from '../src/modules/hostOperations/hostUnifiedListing.public.js'

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
})
test('empty nutrition and missing pricing remain unknown, not fabricated', () => {
  const result = publicListing({ ...baseRecord, packet: { ...baseRecord.packet, selling: {}, nutrition: null } })
  assert.equal(result.nutrition, null)
  assert.equal(result.offer.declaredPrice, null)
})
