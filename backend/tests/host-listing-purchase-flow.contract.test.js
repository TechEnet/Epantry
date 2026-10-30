// Dependency-free regression checks for the Host -> Admin -> Customer -> Seller
// boundary. These tests do not charge cards, mutate MongoDB or impersonate a
// payment provider. Full live sandbox E2E still needs authenticated fixtures.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from '../src/modules/commerce/commerce.payment.provider.js'
import { calculatePackPlan } from '../src/modules/commerce/commerce.engine.js'
import { publicListing, publishedHostRecord, publicHostListingFilter } from '../src/modules/hostOperations/hostUnifiedListing.public.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const id = '507f1f77bcf86cd799439011'

function withTemporaryEnv(name, value, callback) {
  const previous = process.env[name]
  try {
    if (value == null) delete process.env[name]
    else process.env[name] = value
    return callback()
  } finally {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  }
}

test('Pending Host edits never leak into the approved Customer recipe or offer', () => {
  const record = {
    _id: id, status: 'submitted_for_review', title: 'Unreviewed new recipe',
    type: 'prepared_food', packet: { title: 'Unreviewed new recipe',
      shareRecipe: true, sellReadyMade: true, ingredients: [{ name: 'Secret', quantity: 1, unit: 'kg' }],
      selling: { salePrice: 1, stockQuantity: 1000 } },
    publishedTitle: 'Approved ready-made meal', publishedType: 'prepared_food',
    publishedPacket: { title: 'Approved ready-made meal', shareRecipe: false, sellReadyMade: true,
      ingredients: [{ name: 'Private ingredient', quantity: 200, unit: 'g' }],
      steps: [{ instruction: 'Private technique' }],
      selling: { salePrice: 150, stockQuantity: 2 },
      delivery: { fulfillment: 'pickup', postalCodes: ['110001'] } },
    verifiedPackId: null, verifiedProductPath: null,
  }
  assert.equal(publishedHostRecord(record).title, 'Approved ready-made meal')
  const customer = publicListing(record)
  assert.equal(customer.title, 'Approved ready-made meal')
  assert.equal(customer.offer.declaredPrice, 150)
  assert.equal(customer.offer.purchasable, false)
  assert.deepEqual(customer.ingredients, [])
  assert.deepEqual(customer.steps, [])
  assert.equal(customer.fulfillmentType, 'pickup')
  assert.equal(customer.canonicalPackId, null)
  assert.equal(customer.marketplaceProductPath, null)
  assert.ok(!Object.hasOwn(customer, 'stockQuantity'))
  assert.ok(!Object.hasOwn(customer, 'publishedPacket'))
  const publicFilter = publicHostListingFilter()
  assert.equal(publicFilter.deletedAt, null)
  assert.equal(publicFilter.$or.length, 2)
})

test('Recipe used quantity and shopping pack count remain different', () => {
  const planned = calculatePackPlan({ requirementQuantity: 300, requirementUnit: 'g',
    packQuantity: 200, packUnit: 'g', sellableQuantity: 10 })
  assert.equal(planned.packCount, 2)
  assert.equal(planned.suppliedQuantity, 400)
  assert.equal(planned.surplusQuantity, 100)
})

test('Existing hosted test-payment signature is checked cryptographically, never trusted by client flag', () => {
  withTemporaryEnv('RAZORPAY_KEY_SECRET', 'epantry-sandbox-unit-secret', () => {
    const providerOrderId = 'order_test_123'
    const providerPaymentId = 'pay_test_123'
    const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${providerOrderId}|${providerPaymentId}`).digest('hex')
    assert.equal(verifyRazorpayCheckoutSignature({ providerOrderId, providerPaymentId, signature }), true)
    assert.equal(verifyRazorpayCheckoutSignature({ providerOrderId, providerPaymentId: 'pay_tampered', signature }), false)
    assert.equal(verifyRazorpayCheckoutSignature({ providerOrderId, providerPaymentId, signature: 'bad' }), false)
  })
  withTemporaryEnv('RAZORPAY_KEY_SECRET', null, () => {
    assert.equal(verifyRazorpayCheckoutSignature({ providerOrderId: 'order_test', providerPaymentId: 'pay_test', signature: 'a'.repeat(64) }), false)
  })
})

test('Webhook uses the raw signed body; altered status cannot create an order', () => {
  withTemporaryEnv('RAZORPAY_WEBHOOK_SECRET', 'epantry-webhook-test-secret', () => {
    const rawBody = Buffer.from('{"event":"payment.captured","id":"evt_test"}')
    const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody).digest('hex')
    assert.equal(verifyRazorpayWebhookSignature({ rawBody, signature }), true)
    assert.equal(verifyRazorpayWebhookSignature({ rawBody: Buffer.from('{"event":"payment.failed"}'), signature }), false)
    assert.equal(verifyRazorpayWebhookSignature({ rawBody: rawBody.toString(), signature }), false)
  })
})

test('Publication, sellability, checkout and fulfilment remain behind distinct protected APIs', () => {
  const listing = read('src/modules/hostOperations/hostUnifiedListing.routes.js')
  const marketplace = read('src/modules/marketplace/marketplace.host.routes.js')
  const commerce = read('src/modules/commerce/commerce.routes.js')
  const hostOrders = read('src/modules/commerce/commerce.host.routes.js')
  const finalService = read('src/modules/commerce/commerce.final.service.js')
  const provider = read('src/modules/commerce/commerce.payment.provider.js')
  assert.match(listing, /\/admin\/host-listing-packets\/:id\/publish-catalog[^\n]*requireAdminPermission\('catalog\.publish'\)/)
  assert.match(listing, /validateCatalogMatch\(publishedPacket\)/)
  assert.match(listing, /\/host\/listing-packets\/:id\/selling-readiness/)
  assert.match(marketplace, /\/offers\/:id\/activate/)
  assert.match(marketplace, /activateHostOfferController/)
  assert.match(marketplace, /createHostInventorySnapshotsController|createBulkInventorySnapshotsController/)
  assert.match(commerce, /'\/checkout'/)
  assert.match(commerce, /prepareFinalCheckout/)
  assert.match(commerce, /'\/payments\/intents'/)
  assert.match(commerce, /'\/payments\/verify'/)
  assert.match(commerce, /verifyCustomerPayment/)
  assert.match(finalService, /fetchRazorpayPayment/)
  assert.match(finalService, /verifyRazorpayCheckoutSignature/)
  assert.match(provider, /crypto\.timingSafeEqual/)
  assert.match(hostOrders, /'\/orders\/:id\/status'/)
  assert.match(hostOrders, /requireIdempotencyKey/)
  assert.match(finalService, /updateHostSellerOrderStatus/)
})
