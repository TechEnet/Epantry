import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeListingPacket, validateListingPacket, calculateListingEstimate,
  allowedListingTypes, canHostListType,
} from '../src/modules/hostOperations/hostUnifiedListing.logic.js'

const example = (type = 'kitchen_recipe') => normalizeListingPacket({
  type, title: 'Wheat cake', category: 'desserts', images: ['https://example.com/cake.webp'],
  shareRecipe: true, baseServings: 4,
  ingredients: [{ name: 'Flour', quantity: 200, unit: 'g', unitPrice: 60, priceQuantity: 1, priceUnit: 'kg' }],
  steps: [{ instruction: 'Mix, then bake.' }],
  delivery: { fulfillment: 'delivery', postalCodes: ['110001'] },
  selling: { outletId: 'existing-outlet-id' },
})

test('Host workspaces cannot add unauthorized listing types', () => {
  assert.deepEqual(allowedListingTypes('brand_seller'), ['grocery', 'brand_recipe'])
  assert.equal(canHostListType('chef_restaurant', 'grocery'), false)
  assert.equal(canHostListType('hybrid', 'prepared_food'), true)
  assert.equal(canHostListType('legacy', 'grocery'), true)
  assert.equal(canHostListType('brand_seller', 'cosmetics'), false)
  assert.equal(validateListingPacket(example(), { submit: true, workspace: 'brand_seller' }).length > 0, true)
})

test('Costing converts kilogram to grams without faking unknown prices', () => {
  const recipe = example()
  assert.equal(calculateListingEstimate(recipe).ingredientCost, 12)
  assert.equal(calculateListingEstimate(recipe).perServingCost, 3)
  recipe.ingredients.push({ name: 'Milk', quantity: 20, unit: 'ml', unitPrice: null, priceQuantity: null, priceUnit: 'l' })
  assert.equal(calculateListingEstimate(recipe).fullRecipeCost, null)
  assert.equal(calculateListingEstimate(recipe).incomplete, true)
})

test('Blank costs remain unknown, not zero', () => {
  const recipe = normalizeListingPacket({ type: 'kitchen_recipe', ingredients: [{ name: 'Flour', quantity: 2, unit: 'g', unitPrice: '', priceQuantity: '', priceUnit: 'kg' }] })
  assert.equal(recipe.ingredients[0].unitPrice, null)
  assert.equal(calculateListingEstimate(recipe).ingredientCost, null)
})

test('A complete draft submits without marketplace publishing', () => {
  assert.deepEqual(validateListingPacket(example(), { submit: true, workspace: 'chef_restaurant' }), [])
  const noPic = example()
  noPic.images = []
  assert.match(validateListingPacket(noPic, { submit: true, workspace: 'chef_restaurant' }).join(' '), /Upload/)
})

test('Ready-made food requires price, stock, and chosen delivery area', () => {
  const recipe = example('prepared_food')
  let errors = validateListingPacket(recipe, { submit: true, workspace: 'chef_restaurant' })
  assert.ok(errors.some((value) => value.includes('selling price')))
  assert.ok(errors.some((value) => value.includes('stock')))
  recipe.selling.salePrice = 340
  recipe.selling.stockQuantity = 0
  errors = validateListingPacket(recipe, { submit: true, workspace: 'chef_restaurant' })
  assert.deepEqual(errors, [])
})

test('Only real six-digit pin codes are kept', () => {
  const packet = normalizeListingPacket({ type: 'grocery', delivery: { postalCodes: ['110001', '110001', 'oops', '012345'] } })
  assert.deepEqual(packet.delivery.postalCodes, ['110001'])
})

test('Unsafe URLs are not persisted as media', () => {
  const packet = normalizeListingPacket({ type: 'grocery', images: ['javascript:alert(1)', 'http://example.com/test', 'https://example.com/test'] })
  assert.deepEqual(packet.images, ['https://example.com/test'])
})

test('Kitchen listings require outlet setup before approval; never after', () => {
  const packet = example()
  packet.selling.outletId = ''
  assert.match(validateListingPacket(packet, { submit: true, workspace: 'chef_restaurant' }).join(' '), /kitchen outlet/)
})
