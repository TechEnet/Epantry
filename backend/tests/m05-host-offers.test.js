import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  createHostOfferSchema,
  updateHostOfferSchema,
} from '../src/modules/marketplace/marketplace.host.validation.js'

import {
  buildCurrentPublishedPackVersionFilter,
  buildOwnedHostOfferFilter,
  serializeHostOffer,
} from '../src/modules/marketplace/marketplace.host.service.js'

/*
|--------------------------------------------------------------------------
| Create Contract
|--------------------------------------------------------------------------
*/

test(
  'M05 Host Offer accepts canonical Pack commercial listing input',
  () => {
    const result =
      createHostOfferSchema.safeParse({
        packId:
          '507f1f77bcf86cd799439011',

        merchantSku:
          'SKU-001',

        fulfillmentTypes: [
          'delivery',
        ],

        minimumOrderQuantity:
          1,

        maximumOrderQuantity:
          5,
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M05 Host Offer input cannot inject Organization ownership',
  () => {
    const result =
      createHostOfferSchema.safeParse({
        packId:
          '507f1f77bcf86cd799439011',

        organizationId:
          '507f1f77bcf86cd799439012',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 Host Offer input rejects price and inventory state',
  () => {
    const result =
      createHostOfferSchema.safeParse({
        packId:
          '507f1f77bcf86cd799439011',

        price:
          100,

        stock:
          20,
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 Host Offer input rejects canonical Product fact injection',
  () => {
    const result =
      createHostOfferSchema.safeParse({
        packId:
          '507f1f77bcf86cd799439011',

        ingredients: [
          'milk',
        ],

        allergens: [
          'milk',
        ],
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Part 2 Lifecycle
|--------------------------------------------------------------------------
*/

test(
  'M05 Part 2 does not allow Host to directly activate an Offer',
  () => {
    const result =
      updateHostOfferSchema.safeParse({
        status:
          'active',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 Host may retire its Offer without deleting commercial history',
  () => {
    const result =
      updateHostOfferSchema.safeParse({
        status:
          'retired',
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Cross-Host Isolation
|--------------------------------------------------------------------------
*/

test(
  'M05 private Host Offer ownership filter always scopes resource by Organization',
  () => {
    const filter =
      buildOwnedHostOfferFilter({
        offerId:
          '507f1f77bcf86cd799439011',

        organizationId:
          '507f1f77bcf86cd799439012',
      })

    assert.deepEqual(
      filter,
      {
        _id:
          '507f1f77bcf86cd799439011',

        organizationId:
          '507f1f77bcf86cd799439012',
      },
    )
  },
)

/*
|--------------------------------------------------------------------------
| Canonical Publication Boundary
|--------------------------------------------------------------------------
*/

test(
  'M05 Offer eligibility requires a published canonical Product Version',
  () => {
    const now =
      new Date(
        '2026-08-22T10:00:00.000Z',
      )

    const filter =
      buildCurrentPublishedPackVersionFilter(
        '507f1f77bcf86cd799439011',
        now,
      )

    assert.equal(
      filter.publicationStatus,
      'published',
    )

    assert.equal(
      filter.packId,
      '507f1f77bcf86cd799439011',
    )

    assert.ok(
      Array.isArray(
        filter.$and,
      ),
    )
  },
)

/*
|--------------------------------------------------------------------------
| Serializer
|--------------------------------------------------------------------------
*/

test(
  'M05 Host Offer serializer exposes commercial identity without canonical facts',
  () => {
    const result =
      serializeHostOffer({
        _id:
          '507f1f77bcf86cd799439011',

        organizationId:
          '507f1f77bcf86cd799439012',

        packId:
          '507f1f77bcf86cd799439013',

        merchantSku:
          'SKU-001',

        offerKey:
          'sku-001',

        status:
          'draft',

        fulfillmentTypes: [
          'delivery',
        ],

        minimumOrderQuantity:
          1,

        maximumOrderQuantity:
          null,

        ingredients: [
          'must-not-leak',
        ],

        price:
          100,
      })

    assert.equal(
      result.id,
      '507f1f77bcf86cd799439011',
    )

    assert.equal(
      result.organizationId,
      '507f1f77bcf86cd799439012',
    )

    assert.equal(
      Object.hasOwn(
        result,
        'ingredients',
      ),
      false,
    )

    assert.equal(
      Object.hasOwn(
        result,
        'price',
      ),
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Route Security Source Contract
|--------------------------------------------------------------------------
*/

test(
  'M05 Host Marketplace routes require session active Host and MFA',
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
      /authenticateSession/,
    )

    assert.match(
      source,
      /loadCurrentUser/,
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
  },
)

test(
  'M05 Host Offer mutations require CSRF protection',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.host.routes.js',
          import.meta.url,
        ),
        'utf8',
      )

    const postOffer =
      source.indexOf(
        "router.post(",
      )

    const patchOffer =
      source.indexOf(
        "router.patch(",
      )

    assert.ok(
      postOffer >=
      0,
    )

    assert.ok(
      patchOffer >=
      0,
    )

    assert.match(
      source.slice(
        postOffer,
        patchOffer,
      ),
      /requireCsrfToken/,
    )

    assert.match(
      source.slice(
        patchOffer,
      ),
      /requireCsrfToken/,
    )
  },
)

test(
  'M05 Host Marketplace router does not grant Super Admin implicit tenant bypass',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.host.routes.js',
          import.meta.url,
        ),
        'utf8',
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

/*
|--------------------------------------------------------------------------
| Service Ownership Source Contract
|--------------------------------------------------------------------------
*/

test(
  'M05 private Offer reads and updates use Organization scoped ownership filter',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.host.service.js',
          import.meta.url,
        ),
        'utf8',
      )

    assert.match(
      source,
      /buildOwnedHostOfferFilter/,
    )

    assert.match(
      source,
      /organizationId:\s*organization\._id/,
    )

    assert.match(
      source,
      /MARKETPLACE_OFFER_NOT_FOUND/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| App Mount
|--------------------------------------------------------------------------
*/

test(
  'M05 Host Marketplace router is mounted separately from public Catalog and Admin',
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
      /marketplaceHostRoutes/,
    )

    assert.match(
      source,
      /'\/api\/v1\/host\/marketplace'/,
    )

    assert.match(
      source,
      /sensitiveResponseNoStoreMiddleware/,
    )
  },
)