import assert from 'node:assert/strict'

import fs from 'node:fs'

import path from 'node:path'

import test from 'node:test'

import request from 'supertest'

import app from '../src/app.js'

import {
  checkoutBodySchema,
} from '../src/modules/commerce/commerce.routes.js'

import {
  ExternalHandoff,
  InventoryReservation,
  InventoryReservationState,
  ParentOrder,
  SellerOrder,
} from '../src/modules/commerce/commerce.transaction.models.js'

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

function assertRoute(
  source,
  routePath,
) {
  const escaped =
    routePath.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    )

  assert.match(
    source,
    new RegExp(
      `path\\s*=\\s*["']${escaped}["']`,
    ),
  )
}

const ID_A =
  'aaaaaaaaaaaaaaaaaaaaaaaa'

test(
  'M11 Part 3 registers reservation parent seller and external handoff collections',
  () => {
    assert.equal(
      InventoryReservationState.collection.name,
      'inventoryReservationStates',
    )

    assert.equal(
      InventoryReservation.collection.name,
      'inventoryReservations',
    )

    assert.equal(
      ParentOrder.collection.name,
      'parentOrders',
    )

    assert.equal(
      SellerOrder.collection.name,
      'sellerOrders',
    )

    assert.equal(
      ExternalHandoff.collection.name,
      'externalHandoffs',
    )
  },
)

test(
  'M11 checkout accepts only Cart identity and rejects client totals ownership or payment state',
  () => {
    assert.deepEqual(
      checkoutBodySchema.parse({
        cartId:
          ID_A,
      }),
      {
        cartId:
          ID_A,
      },
    )

    for (
      const injected
      of [
        {
          householdId:
            ID_A,
        },
        {
          totalLandedCostMinor:
            1,
        },
        {
          paymentStatus:
            'paid',
        },
        {
          sellerId:
            ID_A,
        },
      ]
    ) {
      assert.throws(
        () =>
          checkoutBodySchema.parse({
            cartId:
              ID_A,

            ...injected,
          }),
      )
    }
  },
)

test(
  'M11 checkout routes remain Customer capability protected and CSRF protected',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.routes.js',
      )

    assert.match(
      source,
      /['"]\/checkout['"]/,
    )

    assert.match(
      source,
      /['"]\/orders['"]/,
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
  'M11 reservation overlay does not mutate frozen M05 InventorySnapshot history',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.checkout.service.js',
      )

    assert.match(
      source,
      /InventorySnapshot/,
    )

    assert.match(
      source,
      /InventoryReservationState/,
    )

    assert.doesNotMatch(
      source,
      /InventorySnapshot\s*\.\s*(?:create|insertMany|updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany)/,
    )
  },
)

test(
  'M11 reservation state provides one atomic contention point per Offer and Inventory Node',
  () => {
    const modelSource =
      readBackend(
        'src/modules/commerce/commerce.transaction.models.js',
      )

    const serviceSource =
      readBackend(
        'src/modules/commerce/commerce.checkout.service.js',
      )

    assert.match(
      modelSource,
      /offerId[\s\S]*inventoryNodeId[\s\S]*unique:\s*true/,
    )

    assert.match(
      serviceSource,
      /checkoutReservedQuantity/,
    )

    assert.match(
      serviceSource,
      /\$expr/,
    )

    assert.match(
      serviceSource,
      /\$add:[\s\S]*checkoutReservedQuantity/,
    )
  },
)

test(
  'M11 scarce inventory reservation explicitly supports expiry and release',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.checkout.service.js',
      )

    const modelSource =
      readBackend(
        'src/modules/commerce/commerce.transaction.models.js',
      )

    assert.match(
      modelSource,
      /expiresAt/,
    )

    assert.match(
      modelSource,
      /['"]expired['"]/,
    )

    assert.match(
      source,
      /reservation_expired/,
    )

    assert.match(
      source,
      /expireParentOrderReservations/,
    )
  },
)

test(
  'M11 checkout refuses to pretend incomplete landed cost is payment ready',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.checkout.service.js',
      )

    assert.match(
      source,
      /LANDED_COST_INCOMPLETE/,
    )

    assert.match(
      source,
      /landedCostCompleteness/,
    )

    assert.match(
      source,
      /paymentReady/,
    )
  },
)

test(
  'M11 checkout fails closed while seller cancellation and return policies are not governed',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.checkout.service.js',
      )

    assert.match(
      source,
      /SELLER_POLICIES_NOT_CONFIGURED/,
    )

    assert.match(
      source,
      /cancellationPolicyState/,
    )

    assert.match(
      source,
      /returnPolicyState/,
    )
  },
)

test(
  'M11 transaction models never store raw payment card credentials',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.transaction.models.js',
      )

    assert.doesNotMatch(
      source,
      /cardNumber|cvv|cvc|rawCard|paymentPassword/i,
    )
  },
)

test(
  'M11 keeps ParentOrder customer aggregation separate from seller-scoped SellerOrder',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.transaction.models.js',
      )

    assert.match(
      source,
      /sellerOrderIds/,
    )

    assert.match(
      source,
      /parentOrderId/,
    )

    assert.match(
      source,
      /organizationId/,
    )

    assert.match(
      source,
      /seller_accepted/,
    )
  },
)

test(
  'M11 external handoff can only be recorded by server adapter with HTTPS destination',
  () => {
    const serviceSource =
      readBackend(
        'src/modules/commerce/commerce.checkout.service.js',
      )

    const routeSource =
      readBackend(
        'src/modules/commerce/commerce.routes.js',
      )

    assert.match(
      serviceSource,
      /recordExternalHandoffFromAdapter/,
    )

    assert.match(
      serviceSource,
      /parsedUrl\.protocol\s*!==[\s\S]*['"]https:['"]/,
    )

    assert.doesNotMatch(
      routeSource,
      /post\(\s*['"]\/external-handoffs['"]/,
    )
  },
)

test(
  'M11 One Retailer fallback cannot be mislabeled as a one-retailer Cart',
  () => {
    const source =
      readBackend(
        'src/modules/commerce/commerce.checkout.service.js',
      )

    assert.match(
      source,
      /ONE_RETAILER_OBJECTIVE_NOT_SATISFIED/,
    )

    assert.match(
      source,
      /objectiveSatisfied/,
    )
  },
)

test(
  'M11 live checkout mutation rejects unauthenticated request',
  async () => {
    const response =
      await request(
        app,
      )
        .post(
          '/api/v1/checkout',
        )
        .set(
          'Idempotency-Key',
          'm11-checkout-test',
        )
        .send({
          cartId:
            ID_A,
        })

    assert.equal(
      response.status,
      401,
    )
  },
)

test(
  'M11 live Parent Order read rejects unauthenticated request',
  async () => {
    const response =
      await request(
        app,
      ).get(
        `/api/v1/orders/${ID_A}`,
      )

    assert.equal(
      response.status,
      401,
    )
  },
)

test(
  'M11 frontend service exposes compare Cart checkout and Order APIs with CSRF idempotency',
  () => {
    const source =
      readFrontend(
        'src/features/commerce/services/commerce.service.js',
      )

    for (
      const literal
      of [
        '/basket-optimize',
        '/basket-quotes/',
        '/cart',
        '/checkout',
        '/orders/',
      ]
    ) {
      assert.ok(
        source.includes(
          literal,
        ),
      )
    }

    assert.match(
      source,
      /\/auth\/csrf/,
    )

    assert.match(
      source,
      /Idempotency-Key/,
    )
  },
)

test(
  'M11 composes commerce after M10 Requirement Basket instead of rewriting M10 truth',
  () => {
    const routeSource =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      routeSource,
      /<OutcomePlanPage\s+view=["']basket["']\s*\/>/,
    )

    assert.match(
      routeSource,
      /<RequirementBasketCommerceBridge\s*\/>/,
    )
  },
)

test(
  'M11 P19 exposes Best Value Minimum Waste and One Retailer transparently',
  () => {
    const source =
      readFrontend(
        'src/features/commerce/pages/FulfillmentComparePage.jsx',
      )

    assert.match(
      source,
      /Best Value/,
    )

    assert.match(
      source,
      /Minimum Waste/,
    )

    assert.match(
      source,
      /One Retailer/,
    )

    assert.match(
      source,
      /Objective unavailable/,
    )
  },
)

test(
  'M11 P19 shows price and inventory observation freshness without fake exact stock',
  () => {
    const source =
      readFrontend(
        'src/features/commerce/pages/FulfillmentComparePage.jsx',
      )

    assert.match(
      source,
      /Price observed/,
    )

    assert.match(
      source,
      /Inventory observed/,
    )

    assert.doesNotMatch(
      source,
      /exact stock|stock quantity:\s*\{/i,
    )
  },
)

test(
  'M11 P19 never presents known item subtotal as total landed cost',
  () => {
    const source =
      readFrontend(
        'src/features/commerce/pages/FulfillmentComparePage.jsx',
      )

    assert.match(
      source,
      /Known item subtotal/,
    )

    assert.match(
      source,
      /total landed cost is intentionally not claimed/,
    )
  },
)

test(
  'M11 P19 keeps unmatched requirements visible instead of fuzzy guessing',
  () => {
    const source =
      readFrontend(
        'src/features/commerce/pages/FulfillmentComparePage.jsx',
      )

    assert.match(
      source,
      /Some requirements remain unmatched/,
    )

    assert.match(
      source,
      /will not use fuzzy guessing/,
    )
  },
)

test(
  'M11 P20 visibly keeps seller splits and external handoffs separate',
  () => {
    const source =
      readFrontend(
        'src/features/commerce/pages/MarketplaceCartPage.jsx',
      )

    assert.match(
      source,
      /P20 · Marketplace Cart/,
    )

    assert.match(
      source,
      /Seller split/,
    )

    assert.match(
      source,
      /External retailer handoffs are separate transaction/,
    )
  },
)

test(
  'M11 P20 explains checkout cost incompleteness instead of inventing fees',
  () => {
    const source =
      readFrontend(
        'src/features/commerce/pages/MarketplaceCartPage.jsx',
      )

    assert.match(
      source,
      /Checkout total is not complete yet/,
    )

    assert.match(
      source,
      /does not pretend this subtotal is the final payable total/,
    )
  },
)

test(
  'M11 P19 and P20 routes are Customer capability only and never activeMode authorization',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assertRoute(
      source,
      '/outcome-plans/:planId/compare',
    )

    assertRoute(
      source,
      '/cart/:cartId',
    )

    for (
      const routePath
      of [
        '/outcome-plans/:planId/compare',
        '/cart/:cartId',
      ]
    ) {
      const index =
        source.indexOf(
          `path="${routePath}"`,
        )

      assert.notEqual(
        index,
        -1,
      )

      const nextRouteIndex =
        source.indexOf(
          '<Route',
          index +
            10,
        )

      const section =
        source.slice(
          index,
          nextRouteIndex ===
            -1
            ? undefined
            : nextRouteIndex,
        )

      assert.match(
        section,
        /APPLICATION_ACCESS_TYPES\.CUSTOMER/,
      )

      assert.doesNotMatch(
        section,
        /APPLICATION_ACCESS_TYPES\.(?:HOST|SUPER_ADMIN)/,
      )
    }

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M11 frontend creates no Seller Brand or B2B top-level application authority',
  () => {
    const source =
      [
        readFrontend(
          'src/features/commerce/services/commerce.service.js',
        ),

        readFrontend(
          'src/features/commerce/components/RequirementBasketCommerceBridge.jsx',
        ),

        readFrontend(
          'src/features/commerce/pages/FulfillmentComparePage.jsx',
        ),

        readFrontend(
          'src/features/commerce/pages/MarketplaceCartPage.jsx',
        ),
      ].join(
        '\n',
      )

    assert.doesNotMatch(
      source,
      /sellerEnabled|brandEnabled|b2bEnabled|APPLICATION_ACCESS_TYPES\.(SELLER|BRAND|B2B)/,
    )
  },
)