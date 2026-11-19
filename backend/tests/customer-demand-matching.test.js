import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesCustomerDemand, normalizeDemandProductName } from '../src/modules/notifications/customerDemandMatch.js'

test('customer demand normalization is stable', () => {
  assert.equal(normalizeDemandProductName('  Amul--Butter  200 G '), 'amul butter 200 g')
})
test('matching allows exact product, sizes and prefix/suffix ingredient names', () => {
  assert.equal(matchesCustomerDemand('Amul Butter', 'Amul Butter 500 g'), true)
  assert.equal(matchesCustomerDemand('Strawberry Matcha', 'Japanese Strawberry Matcha Latte'), true)
  assert.equal(matchesCustomerDemand('Milk', 'Organic Milk'), true)
})
test('matching rejects substrings, unrelated products and tiny search terms', () => {
  assert.equal(matchesCustomerDemand('Milk', 'Milkshake'), false)
  assert.equal(matchesCustomerDemand('Apple', 'Pineapple Juice'), false)
  assert.equal(matchesCustomerDemand('Butter', 'Buttermilk'), false)
  assert.equal(matchesCustomerDemand('xy', 'xy milk'), false)
})
