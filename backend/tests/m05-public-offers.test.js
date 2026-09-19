import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  publicPackOffersQuerySchema,
} from '../src/modules/marketplace/marketplace.public.validation.js'

import {
  isPublicOfferEligible,
  serializePublicEligibleOffer,
} from '../src/modules/marketplace/marketplace.public.service.js'

/*
|--------------------------------------------------------------------------
| Public Query
|--------------------------------------------------------------------------
*/

test(
  'M05 public Offer lookup requires exact valid pincode',
  () => {
    const valid =
      publicPackOffersQuerySchema.safeParse({
        pincode:
          '273001',
      })

    const invalid =
      publicPackOffersQuerySchema.safeParse({
        pincode:
          '27300',
      })

    assert.equal(
      valid.success,
      true,
    )

    assert.equal(
      invalid.success,
      false,
    )
  },
)

test(
  'M05 public Offer lookup normalizes spaced pincode',
  () => {
    const result =
      publicPackOffersQuerySchema.parse({
        pincode:
          '273 001',
      })

    assert.equal(
      result.pincode,
      '273001',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Eligibility
|--------------------------------------------------------------------------
*/

test(
  'M05 public Offer requires active Organization and active Offer',
  () => {
    assert.equal(
      isPublicOfferEligible({
        organization: {
          status:
            'active',
        },

        offer: {
          status:
            'active',
        },

        priceRule: {
          id:
            'price',
        },

        serviceable:
          true,

        sellableQuantity:
          10,
      }),
      true,
    )

    assert.equal(
      isPublicOfferEligible({
        organization: {
          status:
            'suspended',
        },

        offer: {
          status:
            'active',
        },

        priceRule: {
          id:
            'price',
        },

        serviceable:
          true,

        sellableQuantity:
          10,
      }),
      false,
    )
  },
)

test(
  'M05 public Offer without effective price is not eligible',
  () => {
    assert.equal(
      isPublicOfferEligible({
        organization: {
          status:
            'active',
        },

        offer: {
          status:
            'active',
        },

        priceRule:
          null,

        serviceable:
          true,

        sellableQuantity:
          10,
      }),
      false,
    )
  },
)

test(
  'M05 public Offer outside serviceability is not eligible',
  () => {
    assert.equal(
      isPublicOfferEligible({
        organization: {
          status:
            'active',
        },

        offer: {
          status:
            'active',
        },

        priceRule: {
          id:
            'price',
        },

        serviceable:
          false,

        sellableQuantity:
          10,
      }),
      false,
    )
  },
)

test(
  'M05 out-of-stock Offer is not publicly eligible',
  () => {
    assert.equal(
      isPublicOfferEligible({
        organization: {
          status:
            'active',
        },

        offer: {
          status:
            'active',
        },

        priceRule: {
          id:
            'price',
        },

        serviceable:
          true,

        sellableQuantity:
          0,
      }),
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Public Projection
|--------------------------------------------------------------------------
*/

test(
  'M05 public Offer serializer exposes commercial result without exact stock',
  () => {
    const result =
      serializePublicEligibleOffer({
        organization: {
          displayName:
            'Demo Host',

          slug:
            'demo-host',

          ownerUserId:
            'private-user',
        },

        offer: {
          _id:
            'offer-1',

          packId:
            'pack-1',

          merchantSku:
            'SKU-1',

          minimumOrderQuantity:
            1,

          maximumOrderQuantity:
            5,
        },

        priceRule: {
          listPrice: {
            amountMinor:
              3500,

            currency:
              'INR',
          },

          salePrice: {
            amountMinor:
              3200,

            currency:
              'INR',
          },

          effectiveFrom:
            '2026-08-22T10:00:00.000Z',

          effectiveTo:
            null,

          createdAt:
            '2026-08-22T10:01:00.000Z',
        },

        fulfillmentTypes: [
          'delivery',
        ],

        sellableQuantity:
          42,

        latestObservedAt:
          '2026-08-22T10:05:00.000Z',

        at:
          new Date(
            '2026-08-22T10:10:00.000Z',
          ),
      })

    assert.equal(
      result.price.effectiveAmountMinor,
      3200,
    )

    assert.equal(
      result.availability,
      'in_stock',
    )

    assert.equal(
      result.inventoryAgeSeconds,
      300,
    )

    assert.equal(
      Object.hasOwn(
        result,
        'sellableQuantity',
      ),
      false,
    )

    assert.equal(
      Object.hasOwn(
        result.seller,
        'ownerUserId',
      ),
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Activation Boundary
|--------------------------------------------------------------------------
*/

test(
  'M05 Host generic Offer update still cannot directly activate Offer',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.host.validation.js',
          import.meta.url,
        ),
        'utf8',
      )

    assert.match(
      source,
      /status !==\s*'active'/,
    )
  },
)

test(
  'M05 Host Offer activation uses dedicated readiness route with CSRF',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.host.routes.js',
          import.meta.url,
        ),
        'utf8',
      )

    assert.match(
      source,
      /'\/offers\/:id\/readiness'/,
    )

    const activationPosition =
      source.indexOf(
        "'/offers/:id/activate'",
      )

    assert.ok(
      activationPosition >
      0,
    )

    const surrounding =
      source.slice(
        activationPosition,
        activationPosition +
          260,
      )

    assert.match(
      surrounding,
      /requireCsrfToken/,
    )
  },
)

test(
  'M05 Offer readiness requires canonical price service area node and inventory snapshot',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.offer-readiness.service.js',
          import.meta.url,
        ),
        'utf8',
      )

    assert.match(
      source,
      /validateOfferCanonicalPack/,
    )

    assert.match(
      source,
      /effectivePrice/,
    )

    assert.match(
      source,
      /serviceArea/,
    )

    assert.match(
      source,
      /activeInventoryNode/,
    )

    assert.match(
      source,
      /inventorySnapshot/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Public Router
|--------------------------------------------------------------------------
*/

test(
  'M05 public Marketplace router exposes eligible Pack Offers without authentication',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.public.routes.js',
          import.meta.url,
        ),
        'utf8',
      )

    assert.match(
      source,
      /'\/packs\/:packId\/offers'/,
    )

    assert.doesNotMatch(
      source,
      /authenticateSession/,
    )

    assert.doesNotMatch(
      source,
      /requireHostAccess/,
    )

    assert.doesNotMatch(
      source,
      /requireSuperAdminAccess/,
    )
  },
)

test(
  'M05 public Marketplace API is mounted separately from canonical Catalog API',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/app.js',
          import.meta.url,
        ),
        'utf8',
      )

    assert.match(
      source,
      /marketplacePublicRoutes/,
    )

    assert.match(
      source,
      /'\/api\/v1\/marketplace'/,
    )

    assert.match(
      source,
      /'\/api\/v1\/catalog'/,
    )
  },
)

test(
  'M05 public service does not mutate or persist price stock into ProductVersion',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.public.service.js',
          import.meta.url,
        ),
        'utf8',
      )

    assert.doesNotMatch(
      source,
      /ProductVersion\.(update|updateOne|updateMany|findOneAndUpdate|create)/,
    )

    assert.doesNotMatch(
      source,
      /Pack\.(update|updateOne|updateMany|findOneAndUpdate|create)/,
    )
  },
)