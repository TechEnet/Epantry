import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  bulkInventorySnapshotSchema,
  createInventoryNodeSchema,
  currentInventoryQuerySchema,
} from '../src/modules/marketplace/marketplace.inventory.validation.js'

import {
  buildOwnedInventoryNodeFilter,
  getSellableQuantity,
  resolveInventoryFreshness,
  summarizeCurrentInventory,
} from '../src/modules/marketplace/marketplace.inventory.service.js'

/*
|--------------------------------------------------------------------------
| Inventory Node Validation
|--------------------------------------------------------------------------
*/

test(
  'M05 Inventory Node accepts Host fulfillment location input',
  () => {
    const result =
      createInventoryNodeSchema.safeParse({
        name:
          'Gorakhpur Warehouse',

        nodeType:
          'warehouse',

        address: {
          city:
            'Gorakhpur',

          state:
            'Uttar Pradesh',

          postalCode:
            '273001',

          countryCode:
            'IN',
        },
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M05 Inventory Node input cannot inject Organization ownership',
  () => {
    const result =
      createInventoryNodeSchema.safeParse({
        name:
          'Warehouse',

        organizationId:
          '507f1f77bcf86cd799439011',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Bulk Inventory Validation
|--------------------------------------------------------------------------
*/

test(
  'M05 bulk inventory accepts valid append-only observation',
  () => {
    const result =
      bulkInventorySnapshotSchema.safeParse({
        items: [
          {
            offerId:
              '507f1f77bcf86cd799439011',

            inventoryNodeId:
              '507f1f77bcf86cd799439012',

            availableQuantity:
              20,

            reservedQuantity:
              3,

            sourceType:
              'manual',

            sourceReference:
              'manual-count-1',
          },
        ],
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M05 bulk inventory rejects reserved quantity above available quantity',
  () => {
    const result =
      bulkInventorySnapshotSchema.safeParse({
        items: [
          {
            offerId:
              '507f1f77bcf86cd799439011',

            inventoryNodeId:
              '507f1f77bcf86cd799439012',

            availableQuantity:
              4,

            reservedQuantity:
              5,
          },
        ],
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 bulk inventory rejects Organization ownership injection',
  () => {
    const result =
      bulkInventorySnapshotSchema.safeParse({
        items: [
          {
            offerId:
              '507f1f77bcf86cd799439011',

            inventoryNodeId:
              '507f1f77bcf86cd799439012',

            availableQuantity:
              10,

            organizationId:
              '507f1f77bcf86cd799439013',
          },
        ],
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 bulk inventory rejects commercial price state',
  () => {
    const result =
      bulkInventorySnapshotSchema.safeParse({
        items: [
          {
            offerId:
              '507f1f77bcf86cd799439011',

            inventoryNodeId:
              '507f1f77bcf86cd799439012',

            availableQuantity:
              10,

            price:
              100,
          },
        ],
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 bulk inventory rejects duplicate Offer and Node pair in one request',
  () => {
    const result =
      bulkInventorySnapshotSchema.safeParse({
        items: [
          {
            offerId:
              '507f1f77bcf86cd799439011',

            inventoryNodeId:
              '507f1f77bcf86cd799439012',

            availableQuantity:
              10,
          },

          {
            offerId:
              '507f1f77bcf86cd799439011',

            inventoryNodeId:
              '507f1f77bcf86cd799439012',

            availableQuantity:
              12,
          },
        ],
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 bulk inventory limits one request to 250 observations',
  () => {
    const items =
      Array.from(
        {
          length:
            251,
        },
        (
          _,
          index,
        ) => ({
          offerId:
            '507f1f77bcf86cd799439011',

          inventoryNodeId:
            `${index}`
              .padStart(
                24,
                '0',
              )
              .slice(
                -24,
              ),

          availableQuantity:
            1,
        }),
      )

    const result =
      bulkInventorySnapshotSchema.safeParse({
        items,
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Cross-Host Ownership
|--------------------------------------------------------------------------
*/

test(
  'M05 Inventory Node ownership filter always scopes by Organization',
  () => {
    const result =
      buildOwnedInventoryNodeFilter({
        inventoryNodeId:
          'node-a',

        organizationId:
          'organization-a',
      })

    assert.deepEqual(
      result,
      {
        _id:
          'node-a',

        organizationId:
          'organization-a',
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Availability Math
|--------------------------------------------------------------------------
*/

test(
  'M05 sellable inventory subtracts reserved quantity deterministically',
  () => {
    assert.equal(
      getSellableQuantity({
        availableQuantity:
          20,

        reservedQuantity:
          3,
      }),
      17,
    )
  },
)

test(
  'M05 current inventory summary never reports negative stock',
  () => {
    const result =
      summarizeCurrentInventory([
        {
          availableQuantity:
            5,

          reservedQuantity:
            8,

          observedAt:
            '2026-08-22T10:00:00.000Z',
        },
      ])

    assert.equal(
      result.totals.sellableQuantity,
      0,
    )

    assert.equal(
      result.availability,
      'out_of_stock',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Freshness
|--------------------------------------------------------------------------
*/

test(
  'M05 inventory freshness exposes age without guessing stale threshold',
  () => {
    const result =
      resolveInventoryFreshness(
        {
          observedAt:
            '2026-08-22T10:00:00.000Z',
        },
        {
          at:
            '2026-08-22T10:05:00.000Z',
        },
      )

    assert.equal(
      result.ageSeconds,
      300,
    )

    assert.equal(
      result.isFresh,
      null,
    )
  },
)

test(
  'M05 inventory freshness uses explicit maxAgeSeconds when requested',
  () => {
    const fresh =
      resolveInventoryFreshness(
        {
          observedAt:
            '2026-08-22T10:00:00.000Z',
        },
        {
          at:
            '2026-08-22T10:05:00.000Z',

          maxAgeSeconds:
            600,
        },
      )

    const stale =
      resolveInventoryFreshness(
        {
          observedAt:
            '2026-08-22T10:00:00.000Z',
        },
        {
          at:
            '2026-08-22T10:20:00.000Z',

          maxAgeSeconds:
            600,
        },
      )

    assert.equal(
      fresh.isFresh,
      true,
    )

    assert.equal(
      stale.isFresh,
      false,
    )
  },
)

test(
  'M05 current inventory freshness threshold is bounded',
  () => {
    const valid =
      currentInventoryQuerySchema.safeParse({
        maxAgeSeconds:
          900,
      })

    const invalid =
      currentInventoryQuerySchema.safeParse({
        maxAgeSeconds:
          999999999,
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

/*
|--------------------------------------------------------------------------
| API Security
|--------------------------------------------------------------------------
*/

test(
  'M05 Inventory mutations are protected by Host MFA and CSRF boundary',
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

    assert.match(
      source,
      /'\/inventory-nodes'/,
    )

    assert.match(
      source,
      /'\/inventory-snapshots\/bulk'/,
    )

    const bulkPosition =
      source.indexOf(
        "'/inventory-snapshots/bulk'",
      )

    const surrounding =
      source.slice(
        Math.max(
          0,
          bulkPosition -
            150,
        ),
        bulkPosition +
          300,
      )

    assert.match(
      surrounding,
      /requireCsrfToken/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Append-only Snapshot Contract
|--------------------------------------------------------------------------
*/

test(
  'M05 Inventory Snapshot API exposes no snapshot PATCH or DELETE endpoint',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.host.routes.js',
          import.meta.url,
        ),
        'utf8',
      )

    const routeExpression =
      /router\.(get|post|patch|delete)\(\s*'([^']+)'/g

    const routes =
      []

    let match =
      routeExpression.exec(
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
        routeExpression.exec(
          source,
        )
    }

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
  'M05 Inventory service resolves Offer and Node ownership from same Host Organization',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.inventory.service.js',
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
      /MARKETPLACE_INVENTORY_OFFER_NOT_FOUND/,
    )

    assert.match(
      source,
      /MARKETPLACE_INVENTORY_NODE_NOT_FOUND/,
    )

    assert.doesNotMatch(
      source,
      /superAdminEnabled/,
    )
  },
)