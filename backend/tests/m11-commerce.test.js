import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import request from 'supertest'

import app from '../src/app.js'

import {
  buildCommerceComparisonOptions,
  calculatePackPlan,
  convertPackQuantityToRequirementUnit,
  sortCandidatesForObjective,
} from '../src/modules/commerce/commerce.engine.js'

import {
  BasketQuote,
  MarketplaceCart,
  ProductMatch,
} from '../src/modules/commerce/commerce.models.js'

import {
  basketOptimizeBodySchema,
  createCartBodySchema,
} from '../src/modules/commerce/commerce.routes.js'

const backendRoot =
  new URL(
    '../',
    import.meta.url,
  )

function read(
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

/*
|--------------------------------------------------------------------------
| Source Freeze Helpers
|--------------------------------------------------------------------------
|
| Freeze tests that prohibit executable dependencies must inspect executable
| source rather than prose comments.
|
| This preserves the actual architecture boundary while allowing comments to
| explain why a prohibited dependency is intentionally absent.
|
*/

function stripJavaScriptComments(
  source,
) {
  return source
    .replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    .replace(
      /(^|[^:])\/\/.*$/gm,
      '$1',
    )
}

const ID_A =
  'aaaaaaaaaaaaaaaaaaaaaaaa'

const ID_B =
  'bbbbbbbbbbbbbbbbbbbbbbbb'

const ID_C =
  'cccccccccccccccccccccccc'

function candidate({
  requirementLineId,
  organizationId,
  offerId,
  cost,
  required =
    300,
  surplus =
    0,
  sellerName =
    'Seller',
}) {
  return {
    requirementLineId,
    organizationId,
    offerId,
    sellerName,

    requirementQuantity:
      required,

    surplusQuantity:
      surplus,

    lineTotal: {
      amountMinor:
        cost,

      currency:
        'INR',
    },
  }
}

test(
  'M11 registers productMatches basketQuotes and carts collections',
  () => {
    assert.equal(
      ProductMatch.collection.name,
      'productMatches',
    )

    assert.equal(
      BasketQuote.collection.name,
      'basketQuotes',
    )

    assert.equal(
      MarketplaceCart.collection.name,
      'carts',
    )
  },
)

test(
  'M11 deterministic pack planning converts 300g requirement into two 200g packs with 100g surplus',
  () => {
    const plan =
      calculatePackPlan({
        requirementQuantity:
          300,

        requirementUnit:
          'g',

        packQuantity:
          200,

        packUnit:
          'g',

        sellableQuantity:
          10,
      })

    assert.equal(
      plan.packCount,
      2,
    )

    assert.equal(
      plan.suppliedQuantity,
      400,
    )

    assert.equal(
      plan.surplusQuantity,
      100,
    )
  },
)

test(
  'M11 pack planning uses deterministic M07-compatible unit conversion',
  () => {
    assert.equal(
      convertPackQuantityToRequirementUnit({
        packQuantity:
          0.5,

        packUnit:
          'kg',

        requirementUnit:
          'g',
      }),
      500,
    )
  },
)

test(
  'M11 pack planning rejects an offer maximum quantity that cannot satisfy the requirement',
  () => {
    assert.equal(
      calculatePackPlan({
        requirementQuantity:
          900,

        requirementUnit:
          'g',

        packQuantity:
          200,

        packUnit:
          'g',

        maximumOrderQuantity:
          4,

        sellableQuantity:
          20,
      }),
      null,
    )
  },
)

test(
  'M11 pack planning rejects insufficient serviceable sellable inventory',
  () => {
    assert.equal(
      calculatePackPlan({
        requirementQuantity:
          600,

        requirementUnit:
          'g',

        packQuantity:
          200,

        packUnit:
          'g',

        sellableQuantity:
          2,
      }),
      null,
    )
  },
)

test(
  'M11 Best Value uses known item total with pack surplus only as deterministic tie breaker',
  () => {
    const ranked =
      sortCandidatesForObjective(
        [
          candidate({
            requirementLineId:
              ID_A,

            organizationId:
              ID_A,

            offerId:
              'offer-b',

            cost:
              25000,

            surplus:
              0,
          }),

          candidate({
            requirementLineId:
              ID_A,

            organizationId:
              ID_B,

            offerId:
              'offer-a',

            cost:
              20000,

            surplus:
              100,
          }),
        ],

        'best_value',
      )

    assert.equal(
      ranked[0].offerId,
      'offer-a',
    )
  },
)

test(
  'M11 Minimum Waste prefers lower pack surplus before known item total',
  () => {
    const ranked =
      sortCandidatesForObjective(
        [
          candidate({
            requirementLineId:
              ID_A,

            organizationId:
              ID_A,

            offerId:
              'cheap-surplus',

            cost:
              10000,

            surplus:
              200,
          }),

          candidate({
            requirementLineId:
              ID_A,

            organizationId:
              ID_B,

            offerId:
              'less-waste',

            cost:
              18000,

            surplus:
              20,
          }),
        ],

        'minimum_waste',
      )

    assert.equal(
      ranked[0].offerId,
      'less-waste',
    )
  },
)

test(
  'M11 One Retailer chooses one Organization only when it covers every requirement',
  () => {
    const options =
      buildCommerceComparisonOptions({
        candidateGroups: [
          {
            requirementLineId:
              ID_A,

            candidates: [
              candidate({
                requirementLineId:
                  ID_A,

                organizationId:
                  ID_C,

                offerId:
                  'c-1',

                cost:
                  10000,
              }),

              candidate({
                requirementLineId:
                  ID_A,

                organizationId:
                  ID_A,

                offerId:
                  'a-1',

                cost:
                  9000,
              }),
            ],
          },

          {
            requirementLineId:
              ID_B,

            candidates: [
              candidate({
                requirementLineId:
                  ID_B,

                organizationId:
                  ID_C,

                offerId:
                  'c-2',

                cost:
                  12000,
              }),
            ],
          },
        ],

        totalRequirementCount:
          2,
      })

    const oneRetailer =
      options.find(
        (
          option,
        ) =>
          option.optionKey ===
          'one_retailer',
      )

    assert.equal(
      oneRetailer.objectiveSatisfied,
      true,
    )

    assert.equal(
      oneRetailer.sellerCount,
      1,
    )

    assert.ok(
      oneRetailer.selectedCandidates.every(
        (
          item,
        ) =>
          item.organizationId ===
          ID_C,
      ),
    )
  },
)

test(
  'M11 One Retailer fails transparently rather than pretending a split order is one retailer',
  () => {
    const options =
      buildCommerceComparisonOptions({
        candidateGroups: [
          {
            requirementLineId:
              ID_A,

            candidates: [
              candidate({
                requirementLineId:
                  ID_A,

                organizationId:
                  ID_A,

                offerId:
                  'a-1',

                cost:
                  10000,
              }),
            ],
          },

          {
            requirementLineId:
              ID_B,

            candidates: [
              candidate({
                requirementLineId:
                  ID_B,

                organizationId:
                  ID_B,

                offerId:
                  'b-1',

                cost:
                  10000,
              }),
            ],
          },
        ],

        totalRequirementCount:
          2,
      })

    const oneRetailer =
      options.find(
        (
          option,
        ) =>
          option.optionKey ===
          'one_retailer',
      )

    assert.equal(
      oneRetailer.objectiveSatisfied,
      false,
    )

    assert.ok(
      oneRetailer.explanationCodes.includes(
        'ONE_RETAILER_NOT_AVAILABLE',
      ),
    )
  },
)

test(
  'M11 comparison never labels item-price-only math as total landed cost',
  () => {
    const options =
      buildCommerceComparisonOptions({
        candidateGroups: [
          {
            requirementLineId:
              ID_A,

            candidates: [
              candidate({
                requirementLineId:
                  ID_A,

                organizationId:
                  ID_A,

                offerId:
                  'a-1',

                cost:
                  10000,
              }),
            ],
          },
        ],

        totalRequirementCount:
          1,
      })

    for (
      const option
      of options
    ) {
      assert.equal(
        option.totalLandedCostMinor,
        null,
      )

      assert.equal(
        option.landedCostCompleteness,
        'item_prices_only',
      )
    }
  },
)

test(
  'M11 basket optimize schema accepts Customer choice but rejects ownership price and seller injection',
  () => {
    assert.deepEqual(
      basketOptimizeBodySchema.parse({
        outcomePlanId:
          ID_A,

        pincode:
          '110 001',

        objective:
          'minimum_waste',
      }),

      {
        outcomePlanId:
          ID_A,

        pincode:
          '110001',

        objective:
          'minimum_waste',
      },
    )

    for (
      const injected
      of [
        {
          householdId:
            ID_B,
        },

        {
          sellerId:
            ID_B,
        },

        {
          priceMinor:
            1,
        },
      ]
    ) {
      assert.throws(
        () =>
          basketOptimizeBodySchema.parse({
            outcomePlanId:
              ID_A,

            pincode:
              '110001',

            ...injected,
          }),
      )
    }
  },
)

test(
  'M11 cart schema accepts quote option only and rejects client commercial totals',
  () => {
    assert.deepEqual(
      createCartBodySchema.parse({
        basketQuoteId:
          ID_A,

        optionKey:
          'best_value',
      }),

      {
        basketQuoteId:
          ID_A,

        optionKey:
          'best_value',
      },
    )

    assert.throws(
      () =>
        createCartBodySchema.parse({
          basketQuoteId:
            ID_A,

          optionKey:
            'best_value',

          itemSubtotalMinor:
            1,
        }),
    )
  },
)

test(
  'M11 routes require session active account Customer capability and CSRF on writes',
  () => {
    const source =
      read(
        'src/modules/commerce/commerce.routes.js',
      )

    assert.match(
      source,
      /authenticateSession/,
    )

    assert.match(
      source,
      /requireActiveAccount/,
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
  'M11 service consumes M10 productMatchingInput and existing M05 eligible Offer truth',
  () => {
    const source =
      read(
        'src/modules/commerce/commerce.service.js',
      )

    assert.match(
      source,
      /getOutcomePlan/,
    )

    assert.match(
      source,
      /productMatchingInput/,
    )

    assert.match(
      source,
      /listPublicEligibleOffers/,
    )

    assert.match(
      source,
      /resolveServiceableOfferCapacity/,
    )
  },
)

test(
  'M11 candidate matching is conservative and contains no fuzzy or AI semantic guess path',
  () => {
    const source =
      read(
        'src/modules/commerce/commerce.service.js',
      )

    const executableSource =
      stripJavaScriptComments(
        source,
      )

    /*
    |--------------------------------------------------------------------------
    | Positive Contract
    |--------------------------------------------------------------------------
    |
    | These explicit deterministic strategies must remain present.
    |
    */

    assert.match(
      executableSource,
      /canonical_name_token/,
    )

    assert.match(
      executableSource,
      /single_ingredient_identity/,
    )

    assert.match(
      executableSource,
      /NO_TRUSTWORTHY_ELIGIBLE_PACK_MATCH/,
    )

    /*
    |--------------------------------------------------------------------------
    | Forbidden Executable Matching Dependencies
    |--------------------------------------------------------------------------
    |
    | Comments may document these intentionally absent approaches.
    | Executable source must not import or invoke them.
    |
    */

    assert.doesNotMatch(
      executableSource,
      /OpenAI|OpenRouter|embedding|semanticSimilarity|fuzzyMatch/i,
    )
  },
)

test(
  'M11 unresolved product constraints fail closed instead of bypassing governed matching',
  () => {
    const source =
      read(
        'src/modules/commerce/commerce.service.js',
      )

    assert.match(
      source,
      /PRODUCT_CONSTRAINTS_REQUIRE_GOVERNED_MATCHING/,
    )
  },
)

test(
  'M11 revalidates current price serviceability and sellable inventory before creating Cart',
  () => {
    const source =
      read(
        'src/modules/commerce/commerce.service.js',
      )

    assert.match(
      source,
      /BASKET_QUOTE_PRICE_CHANGED/,
    )

    assert.match(
      source,
      /BASKET_QUOTE_INVENTORY_CHANGED/,
    )

    assert.match(
      source,
      /BASKET_QUOTE_OFFER_STALE/,
    )
  },
)

test(
  'M11 comparison snapshots are append-only while Cart remains a transaction object for later checkout',
  () => {
    const source =
      read(
        'src/modules/commerce/commerce.models.js',
      )

    assert.match(
      source,
      /snapshots are append-only and cannot be changed or deleted/,
    )

    assert.match(
      source,
      /checkout_pending/,
    )
  },
)

test(
  'M11 models store no raw card credentials or payment secret',
  () => {
    const source =
      read(
        'src/modules/commerce/commerce.models.js',
      )

    assert.doesNotMatch(
      source,
      /cardNumber|cvv|cvc|rawCard|paymentPassword/i,
    )
  },
)

test(
  'M11 preserves Customer Host Super Admin as the only application access architecture',
  () => {
    const source =
      [
        read(
          'src/modules/commerce/commerce.models.js',
        ),

        read(
          'src/modules/commerce/commerce.service.js',
        ),

        read(
          'src/modules/commerce/commerce.routes.js',
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

test(
  'M11 app mounts commerce orchestration under API v1 without replacing Marketplace or Outcome Plan routers',
  () => {
    const source =
      read(
        'src/app.js',
      )

    assert.match(
      source,
      /commerceRoutes/,
    )

    assert.match(
      source,
      /marketplacePublicRoutes/,
    )

    assert.match(
      source,
      /outcomePlanRoutes/,
    )
  },
)

test(
  'M11 live basket optimization rejects unauthenticated mutation',
  async () => {
    const response =
      await request(
        app,
      )
        .post(
          '/api/v1/basket-optimize',
        )
        .set(
          'Idempotency-Key',
          'm11-basket-test',
        )
        .send({
          outcomePlanId:
            ID_A,

          pincode:
            '110001',

          objective:
            'best_value',
        })

    assert.equal(
      response.status,
      401,
    )
  },
)

test(
  'M11 live Basket Quote read rejects unauthenticated request',
  async () => {
    const response =
      await request(
        app,
      ).get(
        `/api/v1/basket-quotes/${ID_A}`,
      )

    assert.equal(
      response.status,
      401,
    )
  },
)

test(
  'M11 live Cart creation rejects unauthenticated mutation',
  async () => {
    const response =
      await request(
        app,
      )
        .post(
          '/api/v1/cart',
        )
        .set(
          'Idempotency-Key',
          'm11-cart-test',
        )
        .send({
          basketQuoteId:
            ID_A,

          optionKey:
            'best_value',
        })

    assert.equal(
      response.status,
      401,
    )
  },
)