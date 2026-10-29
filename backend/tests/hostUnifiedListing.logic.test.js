import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeListingPacket, validateListingPacket, calculateListingEstimate,
  allowedListingTypes, canHostListType, isValidGtin,
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

test('Kitchen recipes without a ready-made offer do not require an outlet', () => {
  const packet = example()
  packet.selling.outletId = ''
  assert.deepEqual(validateListingPacket(packet, { submit: true, workspace: 'chef_restaurant' }), [])
  packet.sellReadyMade = true
  packet.selling.salePrice = 250
  packet.selling.stockQuantity = 2
  assert.match(validateListingPacket(packet, { submit: true, workspace: 'chef_restaurant' }).join(' '), /kitchen outlet/)
})

test('GTIN check digits are validated before product submission', () => {
  assert.equal(isValidGtin('4006381333931'), true)
  assert.equal(isValidGtin('4006381333932'), false)
  assert.equal(isValidGtin('12345'), false)
  const product = normalizeListingPacket({
    type: 'grocery', title: 'Packaged rice', category: 'grocery',
    images: ['https://example.com/rice.webp'],
    selling: { barcode: '4006381333932', packQuantity: 1, packUnit: 'kg', salePrice: 100, stockQuantity: 3 },
    delivery: { postalCodes: ['110001'] },
  })
  assert.match(validateListingPacket(product, { submit: true, workspace: 'hybrid' }).join(' '), /valid 8, 12, 13 or 14 digit barcode/)
})

test('Product label evidence and recipe preparation details survive normalization', () => {
  const product = normalizeListingPacket({
    type: 'grocery', labelDeclaration: { ingredients: 'Rice', allergens: 'May contain wheat', claims: 'Gluten free (on label)' },
    catalogProductVersionId: '507f1f77bcf86cd799439011',
  })
  assert.equal(product.labelDeclaration.allergens, 'May contain wheat')
  assert.equal(product.catalogProductVersionId, '507f1f77bcf86cd799439011')
  const recipe = normalizeListingPacket({
    type: 'kitchen_recipe', cuisine: 'Indian', preparationMinutes: 12, cookingMinutes: 40,
    ingredients: [{ name: 'Coriander', quantity: 2, unit: 'g', role: 'garnish', preparationState: 'Chopped', scalingRule: 'fixed' }],
  })
  assert.equal(recipe.cuisine, 'Indian')
  assert.equal(recipe.cookingMinutes, 40)
  assert.equal(recipe.ingredients[0].role, 'garnish')
  assert.equal(recipe.ingredients[0].preparationState, 'Chopped')
  assert.equal(recipe.ingredients[0].scalingRule, 'fixed')
})
