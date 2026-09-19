import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  createServiceAreaSchema,
  listServiceAreasQuerySchema,
  resolveHostServiceabilityQuerySchema,
} from '../src/modules/marketplace/marketplace.serviceability.validation.js'

import {
  buildOwnedServiceAreaFilter,
  buildServiceAreaPostalCodeFilter,
  resolveFulfillmentIntersection,
  resolveServiceAreaInventoryNodeIds,
} from '../src/modules/marketplace/marketplace.serviceability.service.js'

/*
|--------------------------------------------------------------------------
| Service Area Input
|--------------------------------------------------------------------------
*/

test(
  'M05 Service Area accepts explicit pincode serviceability input',
  () => {
    const result =
      createServiceAreaSchema.safeParse({
        name:
          'Gorakhpur Delivery',

        inventoryNodeId:
          '507f1f77bcf86cd799439011',

        postalCodes: [
          '273001',
          '273002',
        ],

        fulfillmentTypes: [
          'delivery',
        ],
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M05 Service Area input cannot inject Organization ownership',
  () => {
    const result =
      createServiceAreaSchema.safeParse({
        name:
          'Injected Area',

        postalCodes: [
          '273001',
        ],

        organizationId:
          '507f1f77bcf86cd799439011',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 Service Area normalizes spaced Indian pincode',
  () => {
    const result =
      createServiceAreaSchema.parse({
        name:
          'Normalized Area',

        postalCodes: [
          '273 001',
        ],
      })

    assert.deepEqual(
      result.postalCodes,
      [
        '273001',
      ],
    )
  },
)

test(
  'M05 Service Area removes duplicate pincodes deterministically',
  () => {
    const result =
      createServiceAreaSchema.parse({
        name:
          'Deduplicated Area',

        postalCodes: [
          '273001',
          '273 001',
          '273002',
        ],
      })

    assert.deepEqual(
      result.postalCodes,
      [
        '273001',
        '273002',
      ],
    )
  },
)

test(
  'M05 Service Area rejects malformed pincode instead of guessing serviceability',
  () => {
    const result =
      createServiceAreaSchema.safeParse({
        name:
          'Invalid Area',

        postalCodes: [
          '27300',
        ],
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 serviceability query requires explicit valid pincode',
  () => {
    const valid =
      resolveHostServiceabilityQuerySchema.safeParse({
        pincode:
          '273001',
      })

    const missing =
      resolveHostServiceabilityQuerySchema.safeParse({})

    assert.equal(
      valid.success,
      true,
    )

    assert.equal(
      missing.success,
      false,
    )
  },
)

test(
  'M05 Service Area list pincode filter normalizes input',
  () => {
    const result =
      listServiceAreasQuerySchema.parse({
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
| Cross-Host Isolation
|--------------------------------------------------------------------------
*/

test(
  'M05 Service Area ownership filter always scopes by Organization',
  () => {
    const filter =
      buildOwnedServiceAreaFilter({
        serviceAreaId:
          'service-area-a',

        organizationId:
          'organization-a',
      })

    assert.deepEqual(
      filter,
      {
        _id:
          'service-area-a',

        organizationId:
          'organization-a',
      },
    )
  },
)

test(
  'M05 pincode serviceability lookup is Organization scoped and exact',
  () => {
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
  },
)

/*
|--------------------------------------------------------------------------
| Fulfillment Resolution
|--------------------------------------------------------------------------
*/

test(
  'M05 serviceability resolves only fulfillment types supported by Offer and Service Area',
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
      })

    assert.deepEqual(
      result,
      [
        'delivery',
      ],
    )
  },
)

test(
  'M05 requested unsupported fulfillment type is not serviceable',
  () => {
    const result =
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
      result,
      [],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Inventory Node Resolution
|--------------------------------------------------------------------------
*/

test(
  'M05 node-specific Service Area resolves only its active Inventory Node',
  () => {
    const result =
      resolveServiceAreaInventoryNodeIds({
        serviceArea: {
          inventoryNodeId:
            'node-a',
        },

        activeInventoryNodeIds: [
          'node-a',
          'node-b',
        ],
      })

    assert.deepEqual(
      result,
      [
        'node-a',
      ],
    )
  },
)

test(
  'M05 disabled node makes node-specific Service Area unavailable',
  () => {
    const result =
      resolveServiceAreaInventoryNodeIds({
        serviceArea: {
          inventoryNodeId:
            'node-a',
        },

        activeInventoryNodeIds: [
          'node-b',
        ],
      })

    assert.deepEqual(
      result,
      [],
    )
  },
)

test(
  'M05 organization-wide Service Area resolves all active Inventory Nodes',
  () => {
    const result =
      resolveServiceAreaInventoryNodeIds({
        serviceArea: {
          inventoryNodeId:
            null,
        },

        activeInventoryNodeIds: [
          'node-a',
          'node-b',
        ],
      })

    assert.deepEqual(
      result.sort(),
      [
        'node-a',
        'node-b',
      ],
    )
  },
)

/*
|--------------------------------------------------------------------------
| API Security
|--------------------------------------------------------------------------
*/

test(
  'M05 Service Area mutations remain inside Host MFA and CSRF boundary',
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
      /requireHostAccess/,
    )

    assert.match(
      source,
      /requireMfaAssurance/,
    )

    const postPosition =
      source.indexOf(
        "'/service-areas'",
        source.indexOf(
          'router.post',
        ),
      )

    assert.ok(
      postPosition >
      0,
    )

    const surrounding =
      source.slice(
        Math.max(
          0,
          postPosition -
            180,
        ),
        postPosition +
          260,
      )

    assert.match(
      surrounding,
      /requireCsrfToken/,
    )
  },
)

test(
  'M05 Serviceability resolver exposes Host preview route without Super Admin tenant bypass',
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
      /'\/offers\/:id\/serviceability'/,
    )

    assert.doesNotMatch(
      source,
      /requireSuperAdminAccess/,
    )

    assert.doesNotMatch(
      source,
      /superAdminEnabled/,
    )
  },
)

test(
  'M05 Serviceability service resolves Service Areas and Nodes inside same Organization',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.serviceability.service.js',
          import.meta.url,
        ),
        'utf8',
      )

    assert.match(
      source,
      /organizationId:\s*organization\._id/,
    )

    assert.match(
      source,
      /MARKETPLACE_SERVICE_AREA_NOT_FOUND/,
    )

    assert.match(
      source,
      /MARKETPLACE_INVENTORY_NODE_NOT_FOUND/,
    )

    assert.doesNotMatch(
      source,
      /sellerId/,
    )
  },
)