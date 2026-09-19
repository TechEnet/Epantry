import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  resolveInventoryFreshness,
} from '../src/modules/marketplace/marketplace.inventory.service.js'

import {
  buildEffectivePriceRuleFilter,
} from '../src/modules/marketplace/marketplace.pricing.service.js'

import {
  isPublicOfferEligible,
  serializePublicEligibleOffer,
} from '../src/modules/marketplace/marketplace.public.service.js'

import {
  buildServiceAreaPostalCodeFilter,
  resolveFulfillmentIntersection,
} from '../src/modules/marketplace/marketplace.serviceability.service.js'

function readBackendFile(
  relativePath,
) {
  return fs.readFileSync(
    new URL(
      `../src/${relativePath}`,
      import.meta.url,
    ),
    'utf8',
  )
}

function readFrontendFile(
  relativePath,
) {
  return fs.readFileSync(
    new URL(
      `../../frontend/${relativePath}`,
      import.meta.url,
    ),
    'utf8',
  )
}

function extractRouteRegistrations(
  source,
) {
  const routes =
    []

  const expression =
    /router\.(get|post|patch|delete)\(\s*['"]([^'"]+)['"]/g

  let match =
    expression.exec(
      source,
    )

  while (
    match
  ) {
    routes.push({
      method:
        match[1],

      path:
        match[2],
    })

    match =
      expression.exec(
        source,
      )
  }

  return routes
}

function getRouteNeighborhood(
  source,
  path,
) {
  const singleQuoted =
    source.indexOf(
      `'${path}'`,
    )

  const doubleQuoted =
    source.indexOf(
      `"${path}"`,
    )

  const position =
    singleQuoted >=
    0
      ? singleQuoted
      : doubleQuoted

  if (
    position <
    0
  ) {
    return ''
  }

  return source.slice(
    Math.max(
      0,
      position -
        120,
    ),
    position +
      320,
  )
}

/*
|--------------------------------------------------------------------------
| Canonical vs Commercial Boundary
|--------------------------------------------------------------------------
*/

test(
  'M05 freeze keeps ProductVersion and Pack read-only inside public Marketplace composition',
  () => {
    const source =
      readBackendFile(
        'modules/marketplace/marketplace.public.service.js',
      )

    assert.doesNotMatch(
      source,
      /ProductVersion\.(create|update|updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany)/,
    )

    assert.doesNotMatch(
      source,
      /Pack\.(create|update|updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany)/,
    )
  },
)

test(
  'M05 freeze keeps public Catalog and Marketplace mounted as separate domains',
  () => {
    const source =
      readBackendFile(
        'app.js',
      )

    assert.match(
      source,
      /['"]\/api\/v1\/catalog['"]/,
    )

    assert.match(
      source,
      /['"]\/api\/v1\/marketplace['"]/,
    )

    assert.match(
      source,
      /catalogPublicRoutes/,
    )

    assert.match(
      source,
      /marketplacePublicRoutes/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Host Authorization Boundary
|--------------------------------------------------------------------------
*/

test(
  'M05 freeze keeps entire Host Marketplace behind active Host capability and MFA',
  () => {
    const source =
      readBackendFile(
        'modules/marketplace/marketplace.host.routes.js',
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
      /requireHostAccess/,
    )

    assert.match(
      source,
      /requireMfaAssurance/,
    )

    assert.doesNotMatch(
      source,
      /requireSuperAdminAccess/,
    )
  },
)

test(
  'M05 freeze keeps Super Admin from receiving an implicit Host tenant bypass',
  () => {
    const files = [
      'modules/marketplace/marketplace.host.routes.js',

      'modules/marketplace/marketplace.host.service.js',

      'modules/marketplace/marketplace.inventory.service.js',

      'modules/marketplace/marketplace.pricing.service.js',

      'modules/marketplace/marketplace.serviceability.service.js',
    ]

    for (
      const file of
      files
    ) {
      const source =
        readBackendFile(
          file,
        )

      assert.doesNotMatch(
        source,
        /superAdminEnabled/,
        `${file} must not implement a Super Admin tenant bypass`,
      )

      assert.doesNotMatch(
        source,
        /requireSuperAdminAccess/,
        `${file} must not implement a Super Admin tenant bypass`,
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Mutation Security
|--------------------------------------------------------------------------
*/

test(
  'M05 freeze keeps commercial mutations CSRF protected',
  () => {
    const source =
      readBackendFile(
        'modules/marketplace/marketplace.host.routes.js',
      )

    const protectedPaths = [
      '/offers',

      '/offers/:id/activate',

      '/offers/:id/prices',

      '/inventory-nodes',

      '/inventory-snapshots/bulk',

      '/service-areas',
    ]

    for (
      const path of
      protectedPaths
    ) {
      const neighborhood =
        getRouteNeighborhood(
          source,
          path,
        )

      assert.ok(
        neighborhood,
        `Route ${path} must exist`,
      )

      assert.match(
        neighborhood,
        /requireCsrfToken/,
        `Route ${path} must remain CSRF protected`,
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Offer Activation Governance
|--------------------------------------------------------------------------
*/

test(
  'M05 freeze prevents generic Host Offer PATCH from granting active status',
  () => {
    const source =
      readBackendFile(
        'modules/marketplace/marketplace.host.validation.js',
      )

    assert.match(
      source,
      /status/,
    )

    assert.match(
      source,
      /active/,
    )

    assert.match(
      source,
      /status\s*!==\s*['"]active['"]/,
    )
  },
)

test(
  'M05 freeze keeps Offer activation behind dedicated readiness workflow',
  () => {
    const routes =
      readBackendFile(
        'modules/marketplace/marketplace.host.routes.js',
      )

    const service =
      readBackendFile(
        'modules/marketplace/marketplace.offer-readiness.service.js',
      )

    assert.match(
      routes,
      /['"]\/offers\/:id\/readiness['"]/,
    )

    assert.match(
      routes,
      /['"]\/offers\/:id\/activate['"]/,
    )

    assert.match(
      service,
      /validateOfferCanonicalPack/,
    )

    assert.match(
      service,
      /effectivePrice/,
    )

    assert.match(
      service,
      /serviceArea/,
    )

    assert.match(
      service,
      /activeInventoryNode/,
    )

    assert.match(
      service,
      /inventorySnapshot/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Append-only Price Governance
|--------------------------------------------------------------------------
*/

test(
  'M05 freeze keeps Host Price Rules append-only through API',
  () => {
    const source =
      readBackendFile(
        'modules/marketplace/marketplace.host.routes.js',
      )

    const routes =
      extractRouteRegistrations(
        source,
      )

    assert.ok(
      routes.some(
        (
          route,
        ) =>
          route.method ===
            'post' &&
          route.path ===
            '/offers/:id/prices',
      ),
    )

    assert.equal(
      routes.some(
        (
          route,
        ) =>
          (
            route.method ===
              'patch' ||
            route.method ===
              'delete'
          ) &&
          route.path.startsWith(
            '/offers/:id/prices',
          ),
      ),
      false,
    )
  },
)

test(
  'M05 freeze keeps effective price lookup tenant scoped and effective dated',
  () => {
    const at =
      new Date(
        '2026-08-22T10:00:00.000Z',
      )

    const filter =
      buildEffectivePriceRuleFilter({
        organizationId:
          'organization-a',

        offerId:
          'offer-a',

        at,
      })

    assert.equal(
      filter.organizationId,
      'organization-a',
    )

    assert.equal(
      filter.offerId,
      'offer-a',
    )

    assert.deepEqual(
      filter.effectiveFrom,
      {
        $lte:
          at,
      },
    )

    assert.ok(
      Array.isArray(
        filter.$or,
      ),
    )
  },
)

/*
|--------------------------------------------------------------------------
| Append-only Inventory Governance
|--------------------------------------------------------------------------
*/

test(
  'M05 freeze keeps Inventory Snapshots append-only through API',
  () => {
    const source =
      readBackendFile(
        'modules/marketplace/marketplace.host.routes.js',
      )

    const routes =
      extractRouteRegistrations(
        source,
      )

    assert.ok(
      routes.some(
        (
          route,
        ) =>
          route.method ===
            'post' &&
          route.path ===
            '/inventory-snapshots/bulk',
      ),
    )

    assert.equal(
      routes.some(
        (
          route,
        ) =>
          (
            route.method ===
              'patch' ||
            route.method ===
              'delete'
          ) &&
          route.path.startsWith(
            '/inventory-snapshots',
          ),
      ),
      false,
    )
  },
)

test(
  'M05 freeze preserves inventory freshness without inventing a stale threshold',
  () => {
    const result =
      resolveInventoryFreshness(
        {
          observedAt:
            '2026-08-22T10:00:00.000Z',
        },
        {
          at:
            '2026-08-22T10:15:00.000Z',
        },
      )

    assert.equal(
      result.ageSeconds,
      900,
    )

    assert.equal(
      result.maxAgeSeconds,
      null,
    )

    assert.equal(
      result.isFresh,
      null,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Serviceability Governance
|--------------------------------------------------------------------------
*/

test(
  'M05 freeze keeps serviceability based on explicit postal codes',
  () => {
    const validationSource =
      readBackendFile(
        'modules/marketplace/marketplace.serviceability.validation.js',
      )

    const serviceSource =
      readBackendFile(
        'modules/marketplace/marketplace.serviceability.service.js',
      )

    const filter =
      buildServiceAreaPostalCodeFilter({
        organizationId:
          'organization-a',

        postalCode:
          '273 001',
      })

    assert.deepEqual(
      filter,
      {
        organizationId:
          'organization-a',

        status:
          'active',

        postalCodes:
          '273001',
      },
    )

    assert.match(
      validationSource,
      /postalCodes/,
    )

    assert.match(
      serviceSource,
      /postalCodes/,
    )

    /*
    |--------------------------------------------------------------------------
    | Only reject actual MongoDB geospatial operators.
    |
    | Human-readable comments may legitimately contain words such as
    | "radius" while explicitly documenting that radius inference is absent.
    |--------------------------------------------------------------------------
    */

    assert.doesNotMatch(
      serviceSource,
      /\$near\b|\$geoNear\b/,
    )
  },
)

test(
  'M05 freeze requires fulfillment support from both Offer and Service Area',
  () => {
    const result =
      resolveFulfillmentIntersection({
        offerFulfillmentTypes: [
          'delivery',
          'pickup',
        ],

        serviceAreaFulfillmentTypes: [
          'delivery',
        ],

        requestedFulfillmentType:
          'delivery',
      })

    assert.deepEqual(
      result,
      [
        'delivery',
      ],
    )

    const unsupported =
      resolveFulfillmentIntersection({
        offerFulfillmentTypes: [
          'pickup',
        ],

        serviceAreaFulfillmentTypes: [
          'delivery',
        ],

        requestedFulfillmentType:
          'delivery',
      })

    assert.deepEqual(
      unsupported,
      [],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Public Eligibility Governance
|--------------------------------------------------------------------------
*/

test(
  'M05 freeze requires every commercial eligibility signal before exposing an Offer',
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
          _id:
            'price-a',
        },

        serviceable:
          true,

        sellableQuantity:
          5,
      }),
      true,
    )

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
          5,
      }),
      false,
    )
  },
)

test(
  'M05 freeze prevents out-of-stock Offers from becoming publicly eligible',
  () => {
    const result =
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
          _id:
            'price-a',
        },

        serviceable:
          true,

        sellableQuantity:
          0,
      })

    assert.equal(
      result,
      false,
    )
  },
)

test(
  'M05 freeze keeps exact stock quantity and private ownership out of public Offer projection',
  () => {
    const result =
      serializePublicEligibleOffer({
        organization: {
          displayName:
            'Host A',

          slug:
            'host-a',

          ownerUserId:
            'private-owner',
        },

        offer: {
          _id:
            'offer-a',

          packId:
            'pack-a',

          merchantSku:
            'SKU-A',

          minimumOrderQuantity:
            1,

          maximumOrderQuantity:
            10,
        },

        priceRule: {
          listPrice: {
            amountMinor:
              5000,

            currency:
              'INR',
          },

          salePrice: {
            amountMinor:
              4500,

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
          37,

        latestObservedAt:
          '2026-08-22T10:05:00.000Z',

        at:
          new Date(
            '2026-08-22T10:10:00.000Z',
          ),
      })

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

    assert.equal(
      result.availability,
      'in_stock',
    )
  },
)

test(
  'M05 freeze keeps public Offer ordering deterministic by effective price',
  () => {
    const source =
      readBackendFile(
        'modules/marketplace/marketplace.public.service.js',
      )

    assert.match(
      source,
      /eligibleOffers\.sort/,
    )

    assert.match(
      source,
      /effectiveAmountMinor/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Public Route Safety
|--------------------------------------------------------------------------
*/

test(
  'M05 freeze keeps public Marketplace Offer route unauthenticated and read-only',
  () => {
    const source =
      readBackendFile(
        'modules/marketplace/marketplace.public.routes.js',
      )

    const routes =
      extractRouteRegistrations(
        source,
      )

    assert.deepEqual(
      routes,
      [
        {
          method:
            'get',

          path:
            '/packs/:packId/offers',
        },
      ],
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

/*
|--------------------------------------------------------------------------
| Frontend Governance
|--------------------------------------------------------------------------
*/

test(
  'M05 freeze keeps Host frontend authorization capability based and independent of activeMode',
  () => {
    const source =
      readFrontendFile(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /APPLICATION_ACCESS_TYPES\.HOST/,
    )

    assert.match(
      source,
      /hostEnabled/,
    )

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M05 freeze keeps P07 Marketplace composition read-only against canonical Product truth',
  () => {
    const source =
      readFrontendFile(
        'src/features/grocery/pages/ProductDetailPage.jsx',
      )

    assert.match(
      source,
      /getPublicPackOffers/,
    )

    assert.match(
      source,
      /pincode/,
    )

    assert.doesNotMatch(
      source,
      /updateProductVersion/,
    )

    assert.doesNotMatch(
      source,
      /publishProductVersion/,
    )
  },
)

test(
  'M05 freeze keeps Marketplace Ops UI permission gated by marketplace.read',
  () => {
    const routes =
      readFrontendFile(
        'src/routes/AppRoutes.jsx',
      )

    const shell =
      readFrontendFile(
        'src/features/admin/components/AdminShell.jsx',
      )

    assert.match(
      routes,
      /permission\s*=\s*["']marketplace\.read["']/,
    )

    assert.match(
      shell,
      /hasAdminPermission\(\s*['"]marketplace\.read['"]/,
    )
  },
)