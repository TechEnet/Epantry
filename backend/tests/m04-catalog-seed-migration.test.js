import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  M04_CATALOG_SEED_VERSION,
  buildCanonicalSeedProductDescriptor,
  buildSeedCategoryDefinitions,
  buildSeedEvidenceChecksum,
  normalizeSeedQuantityUnit,
} from '../src/modules/catalog/catalog.seed.js'

/*
|--------------------------------------------------------------------------
| Unit Normalization
|--------------------------------------------------------------------------
*/

test(
  'M04 seed normalizes legacy litre casing without changing quantity',
  () => {
    assert.equal(
      normalizeSeedQuantityUnit(
        'L',
      ),
      'l',
    )
  },
)

test(
  'M04 seed normalizes tea bag count into supported piece quantity',
  () => {
    assert.equal(
      normalizeSeedQuantityUnit(
        'tea bags',
      ),
      'piece',
    )
  },
)

test(
  'M04 seed refuses to guess an unsupported quantity unit',
  () => {
    assert.throws(
      () =>
        normalizeSeedQuantityUnit(
          'mystery-unit',
        ),
      /Unsupported legacy catalog quantity unit/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Canonical Migration Descriptor
|--------------------------------------------------------------------------
*/

test(
  'M04 seed converts legacy product into canonical Family Variant Pack Version structure',
  () => {
    const descriptor =
      buildCanonicalSeedProductDescriptor({
        id:
          'prod_test_001',

        name:
          'Example Coffee',

        slug:
          'example-coffee',

        brandId:
          'brand_test_001',

        category:
          'grocery',

        subCategory:
          'coffee',

        description:
          'Example description',

        quantity:
          250,

        unit:
          'g',

        image:
          '/products/example.jpg',

        countryOfOrigin:
          'Brazil',

        price:
          999,

        currency:
          'INR',

        availability:
          true,
      })

    assert.equal(
      descriptor.family.slug,
      'example-coffee',
    )

    assert.equal(
      descriptor.variant.variantKey,
      'default',
    )

    assert.equal(
      descriptor.pack.packKey,
      '250_g',
    )

    assert.deepEqual(
      descriptor.version.netQuantity,
      {
        value:
          250,

        unit:
          'g',
      },
    )

    assert.equal(
      descriptor.version.publicationStatus,
      'published',
    )
  },
)

test(
  'M04 canonical seed descriptor excludes price stock currency and availability',
  () => {
    const descriptor =
      buildCanonicalSeedProductDescriptor({
        id:
          'prod_test_002',

        name:
          'Example Product',

        slug:
          'example-product',

        brandId:
          'brand_test_001',

        category:
          'grocery',

        subCategory:
          'snacks',

        quantity:
          100,

        unit:
          'g',

        price:
          250,

        currency:
          'INR',

        availability:
          false,

        stock:
          99,
      })

    assert.equal(
      descriptor.version.price,
      undefined,
    )

    assert.equal(
      descriptor.version.currency,
      undefined,
    )

    assert.equal(
      descriptor.version.availability,
      undefined,
    )

    assert.equal(
      descriptor.version.stock,
      undefined,
    )
  },
)

test(
  'M04 seed does not invent country of origin when legacy source does not provide it',
  () => {
    const descriptor =
      buildCanonicalSeedProductDescriptor({
        id:
          'prod_test_003',

        name:
          'Domestic Seed Product',

        slug:
          'domestic-seed-product',

        brandId:
          'brand_test_001',

        category:
          'grocery',

        subCategory:
          'dairy',

        quantity:
          500,

        unit:
          'g',
      })

    assert.equal(
      descriptor.version
        .countryOfOrigin,
      '',
    )

    assert.deepEqual(
      descriptor.version
        .ingredients,
      [],
    )

    assert.deepEqual(
      descriptor.version
        .allergens,
      [],
    )

    assert.deepEqual(
      descriptor.version
        .claims,
      [],
    )
  },
)

/*
|--------------------------------------------------------------------------
| Categories
|--------------------------------------------------------------------------
*/

test(
  'M04 seed creates deterministic root and child Category definitions',
  () => {
    const categories =
      buildSeedCategoryDefinitions([
        {
          id:
            'one',

          category:
            'grocery',

          subCategory:
            'dairy',
        },

        {
          id:
            'two',

          category:
            'grocery',

          subCategory:
            'hot-sauce',
        },

        {
          id:
            'three',

          category:
            'grocery',

          subCategory:
            'dairy',
        },
      ])

    const grocery =
      categories.find(
        (category) =>
          category.slug ===
          'grocery',
      )

    const dairy =
      categories.find(
        (category) =>
          category.slug ===
          'dairy',
      )

    const hotSauce =
      categories.find(
        (category) =>
          category.slug ===
          'hot-sauce',
      )

    assert.equal(
      grocery.parentSlug,
      null,
    )

    assert.equal(
      dairy.parentSlug,
      'grocery',
    )

    assert.equal(
      hotSauce.name,
      'Hot Sauce',
    )

    assert.equal(
      categories.filter(
        (category) =>
          category.slug ===
          'dairy',
      ).length,
      1,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Evidence
|--------------------------------------------------------------------------
*/

test(
  'M04 canonical seed evidence key is deterministic and versioned',
  () => {
    assert.equal(
      buildSeedEvidenceChecksum(
        'PROD_001',
      ),
      `development_seed:${M04_CATALOG_SEED_VERSION}:prod_001`,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Development Seed Integration
|--------------------------------------------------------------------------
*/

test(
  'M04 development seed invokes canonical catalog migration while preserving legacy transition data',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../scripts/seed-development-data.mjs',
          import.meta.url,
        ),
        'utf8',
      )

    assert.match(
      source,
      /seedCanonicalCatalog/,
    )

    assert.match(
      source,
      /products:\s*allProducts/,
    )

    assert.match(
      source,
      /brands:\s*allBrands/,
    )

    assert.match(
      source,
      /upsertLegacySeedCollection\(\s*'products'/s,
    )

    assert.match(
      source,
      /upsertLegacyBrands\(/,
    )
  },
)