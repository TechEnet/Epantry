import assert from 'node:assert/strict'

import fs from 'node:fs'

import path from 'node:path'

import test from 'node:test'

import request from 'supertest'

import app from '../src/app.js'

import {
  CommerceHostPolicy,
  CommerceLedgerEntry,
  CommerceOrderEvent,
  CommercePaymentIntent,
  CommercePaymentWebhookEvent,
  SellerPromiseSnapshot,
} from '../src/modules/commerce/commerce.final.models.js'

import {
  externalHandoffBodySchema,
  paymentIntentBodySchema,
  paymentVerifyBodySchema,
} from '../src/modules/commerce/commerce.routes.js'

import {
  hostCommercePolicyBodySchema,
  hostSellerOrderStatusBodySchema,
} from '../src/modules/commerce/commerce.host.routes.js'

const backendRoot =
  new URL(
    '../',
    import.meta.url,
  )

function readBackend(
  relativePath,
) {
  return fs.readFileSync(
    new URL(
      relativePath,
      backendRoot,
    ),
    'utf8',
  )
}

function readFrontend(
  relativePath,
) {
  return fs.readFileSync(
    path.resolve(
      process.cwd(),
      '../frontend',
      relativePath,
    ),
    'utf8',
  )
}

const ID_A =
  'aaaaaaaaaaaaaaaaaaaaaaaa'

test(
  'M11 Final registers Host policy payment promise timeline and ledger collections',
  () => {
    assert.equal(
      CommerceHostPolicy.collection.name,
      'hostCommercePolicies',
    )

    assert.equal(
      SellerPromiseSnapshot.collection.name,
      'sellerPromiseSnapshots',
    )

    assert.equal(
      CommercePaymentIntent.collection.name,
      'payments',
    )

    assert.equal(
      CommercePaymentWebhookEvent.collection.name,
      'paymentWebhookEvents',
    )

    assert.equal(
      CommerceOrderEvent.collection.name,
      'orderEvents',
    )

    assert.equal(
      CommerceLedgerEntry.collection.name,
      'ledgerEntries',
    )
  },
)

test(
  'M11 Final Host policy rejects ownership injection',
  () => {
    assert.throws(
      () =>
        hostCommercePolicyBodySchema.parse({
          currency:
            'INR',

          deliveryFeeMinor:
            0,

          cancellationPolicySummary:
            'Cancellation is allowed before packing begins.',

          returnPolicySummary:
            'Returns follow the listed grocery return conditions.',

          organizationId:
            ID_A,
        }),
    )
  },
)

test(
  'M11 Final payment intent accepts only Order identity',
  () => {
    assert.deepEqual(
      paymentIntentBodySchema.parse({
        orderId:
          ID_A,
      }),
      {
        orderId:
          ID_A,
      },
    )

    assert.throws(
      () =>
        paymentIntentBodySchema.parse({
          orderId:
            ID_A,

          amountMinor:
            100,
        }),
    )
  },
)

test(
  'M11 Final payment verification rejects client paid state injection',
  () => {
    const valid = {
      orderId:
        ID_A,

      razorpayPaymentId:
        'pay_test',

      razorpayOrderId:
        'order_test',

      razorpaySignature:
        'a'.repeat(
          64,
        ),
    }

    assert.deepEqual(
      paymentVerifyBodySchema.parse(
        valid,
      ),
      valid,
    )

    assert.throws(
      () =>
        paymentVerifyBodySchema.parse({
          ...valid,

          paymentStatus:
            'paid',
        }),
    )
  },
)

test(
  'M11 Final external handoff rejects arbitrary redirect URL',
  () => {
    assert.deepEqual(
      externalHandoffBodySchema.parse({
        basketQuoteId:
          ID_A,

        partnerId:
          'demo-retailer',
      }),
      {
        basketQuoteId:
          ID_A,

        partnerId:
          'demo-retailer',
      },
    )

    assert.throws(
      () =>
        externalHandoffBodySchema.parse({
          basketQuoteId:
            ID_A,

          partnerId:
            'demo-retailer',

          destinationUrl:
            'https://evil.example',
        }),
    )
  },
)

test(
  'M11 Final Host status command rejects ownership injection',
  () => {
    assert.deepEqual(
      hostSellerOrderStatusBodySchema.parse({
        status:
          'seller_accepted',
      }),
      {
        status:
          'seller_accepted',
      },
    )

    assert.throws(
      () =>
        hostSellerOrderStatusBodySchema.parse({
          status:
            'seller_accepted',

          organizationId:
            ID_A,
        }),
    )
  },
)

test(
  'M11 Final Customer routes remain Customer capability protected',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.routes.js',
      )

    assert.match(
      source,
      /requireCustomerAccess/,
    )

    assert.match(
      source,
      /requireCsrfToken/,
    )

    assert.doesNotMatch(
      source,
      /requireHostAccess|requireSuperAdminAccess|activeMode\s*(?:===|==|!==|!=)/,
    )
  },
)

test(
  'M11 Final Host commerce requires Host capability MFA and CSRF',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.host.routes.js',
      )

    assert.match(
      source,
      /requireHostAccess/,
    )

    assert.match(
      source,
      /requireMfaAssurance/,
    )

    assert.match(
      source,
      /requireCsrfToken/,
    )
  },
)

test(
  'M11 Final Host organization is server derived',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.final.service.js',
      )

    assert.match(
      source,
      /requireActiveHostMarketplaceOrganization/,
    )

    assert.doesNotMatch(
      source,
      /sellerEnabled|brandEnabled|b2bEnabled/,
    )
  },
)

test(
  'M11 Final checkout captures delivery cancellation and return truth',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.final.service.js',
      )

    assert.match(
      source,
      /CommerceHostPolicy/,
    )

    assert.match(
      source,
      /SellerPromiseSnapshot/,
    )

    assert.match(
      source,
      /deliveryFeeMinor/,
    )

    assert.match(
      source,
      /cancellationPolicySummary/,
    )

    assert.match(
      source,
      /returnPolicySummary/,
    )
  },
)

test(
  'M11 Final browser signature and captured webhook remain separate',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.final.service.js',
      )

    assert.match(
      source,
      /verifyRazorpayCheckoutSignature/,
    )

    assert.match(
      source,
      /status:\s*['"]verified['"]/,
    )

    assert.match(
      source,
      /payment\.captured/,
    )

    assert.match(
      source,
      /finalizePaidPayment/,
    )
  },
)

test(
  'M11 Final webhook uses raw body',
  () => {
    const routeSource =
      readBackend(
        'src/modules/commerce/commerce.webhook.routes.js',
      )

    assert.match(
      routeSource,
      /express\.raw/,
    )

    assert.match(
      routeSource,
      /x-razorpay-signature/,
    )

    assert.match(
      routeSource,
      /x-razorpay-event-id/,
    )
  },
)

test(
  'M11 Final app mounts webhook before JSON parser',
  () => {
    const source =
      readBackend(
        'src/app.js',
      )

    const webhookIndex =
      source.indexOf(
        "'/api/v1/webhooks'",
      )

    const jsonIndex =
      source.indexOf(
        'express.json',
      )

    assert.ok(
      webhookIndex >=
      0,
    )

    assert.ok(
      jsonIndex >
      webhookIndex,
    )
  },
)

test(
  'M11 Final models store no raw payment card credentials',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.final.models.js',
      )

    assert.doesNotMatch(
      source,
      /cardNumber|cvv|cvc|rawCard|paymentPassword/i,
    )
  },
)

test(
  'M11 Final external partner registry is HTTPS only',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.partner.provider.js',
      )

    assert.match(
      source,
      /COMMERCE_EXTERNAL_PARTNERS_JSON/,
    )

    assert.match(
      source,
      /https:/,
    )
  },
)

test(
  'M11 Final frontend exposes Checkout Orders and Host APIs',
  () => {
    const source =
      readFrontend(
        'src/features/commerce/services/commerce.service.js',
      )

    assert.match(
      source,
      /\/payments\/intents/,
    )

    assert.match(
      source,
      /\/payments\/verify/,
    )

    assert.match(
      source,
      /\/external-handoffs/,
    )

    assert.match(
      source,
      /\/host\/commerce\/orders/,
    )
  },
)

test(
  'M11 Final P21 uses hosted Razorpay Checkout and no raw card fields',
  () => {
    const source =
      readFrontend(
        'src/features/commerce/pages/CheckoutPage.jsx',
      )

    assert.match(
      source,
      /checkout\.razorpay\.com/,
    )

    assert.match(
      source,
      /createPaymentIntent/,
    )

    assert.match(
      source,
      /verifyPayment/,
    )

    assert.doesNotMatch(
      source,
      /name=["'](?:cardNumber|cvv|cvc)["']/i,
    )
  },
)

test(
  'M11 Final Host sidebar contains Orders',
  () => {
    const source =
      readFrontend(
        'src/features/host/components/HostShell.jsx',
      )

    assert.match(
      source,
      /label:\s*['"]Orders['"]/,
    )

    assert.match(
      source,
      /\/host\/orders/,
    )
  },
)

test(
  'M11 Final creates no Seller Brand B2B top-level authority',
  () => {
    const source =
      [
        readBackend(
          'src/modules/commerce/commerce.final.service.js',
        ),

        readFrontend(
          'src/routes/AppRoutes.jsx',
        ),
      ].join(
        '\n',
      )

    assert.doesNotMatch(
      source,
      /APPLICATION_ACCESS_TYPES\.(SELLER|BRAND|B2B)|sellerEnabled|brandEnabled|b2bEnabled/,
    )
  },
)

test(
  'M11 Final live payment intent rejects unauthenticated request',
  async () => {
    const response =
      await request(
        app,
      )
        .post(
          '/api/v1/payments/intents',
        )
        .set(
          'Idempotency-Key',
          'm11-final-payment',
        )
        .send({
          orderId:
            ID_A,
        })

    assert.equal(
      response.status,
      401,
    )
  },
)

test(
  'M11 Final live external handoff rejects unauthenticated request',
  async () => {
    const response =
      await request(
        app,
      )
        .post(
          '/api/v1/external-handoffs',
        )
        .set(
          'Idempotency-Key',
          'm11-final-handoff',
        )
        .send({
          basketQuoteId:
            ID_A,

          partnerId:
            'demo-retailer',
        })

    assert.equal(
      response.status,
      401,
    )
  },
)

test(
  'M11 Final live Host Orders rejects unauthenticated request',
  async () => {
    const response =
      await request(
        app,
      ).get(
        '/api/v1/host/commerce/orders',
      )

    assert.equal(
      response.status,
      401,
    )
  },
)