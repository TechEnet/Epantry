import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  buildPublicProductPipeline,
  buildPublicProductSlug,
  parsePublicProductSlug,
  serializePublicProductRecord,
} from '../src/modules/catalog/catalog.public.service.js'

/*
|--------------------------------------------------------------------------
| Public Slug
|--------------------------------------------------------------------------
*/

test(
  'M04 public Product slug is deterministic',
  () => {
    const slug =
      buildPublicProductSlug({
        familySlug:
          'Organic Peanut Butter',

        variantKey:
          'Crunchy 01',

        packKey:
          '500 G Jar',
      })

    assert.equal(
      slug,
      'organic-peanut-butter--crunchy_01--500_g_jar',
    )
  },
)

test(
  'M04 public Product slug round-trips to canonical identity',
  () => {
    const parsed =
      parsePublicProductSlug(
        'organic-peanut-butter--crunchy_01--500_g_jar',
      )

    assert.deepEqual(
      parsed,
      {
        familySlug:
          'organic-peanut-butter',

        variantKey:
          'crunchy_01',

        packKey:
          '500_g_jar',
      },
    )
  },
)

test(
  'M04 malformed public Product slug is rejected',
  () => {
    assert.equal(
      parsePublicProductSlug(
        'not-a-complete-product-slug',
      ),
      null,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Publication Boundary
|--------------------------------------------------------------------------
*/

test(
  'M04 public browse pipeline starts from published canonical versions',
  () => {
    const pipeline =
      buildPublicProductPipeline()

    const source =
      JSON.stringify(
        pipeline,
      )

    assert.match(
      source,
      /"publicationStatus":"published"/,
    )

    assert.match(
      source,
      /"pack\.status":"active"/,
    )

    assert.match(
      source,
      /"variant\.status":"active"/,
    )

    assert.match(
      source,
      /"family\.status":"active"/,
    )

    assert.match(
      source,
      /"brand\.status":"active"/,
    )

    assert.match(
      source,
      /"category\.status":"active"/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Public Serialization
|--------------------------------------------------------------------------
*/

test(
  'M04 public Product serializer exposes safe canonical identity',
  () => {
    const product =
      serializePublicProductRecord({
        _id:
          '64b000000000000000000001',

        displayName:
          'Crunchy Peanut Butter 500g',

        gtin:
          '1234567890123',

        netQuantity: {
          value:
            500,

          unit:
            'g',
        },

        pack: {
          _id:
            '64b000000000000000000002',

          displayName:
            '500g Jar',

          packKey:
            '500g_jar',

          packType:
            'jar',

          multipackCount:
            1,
        },

        variant: {
          _id:
            '64b000000000000000000003',

          canonicalName:
            'Crunchy',

          variantKey:
            'crunchy',

          market:
            'IN',

          flavor:
            'Original',
        },

        family: {
          _id:
            '64b000000000000000000004',

          canonicalName:
            'Organic Peanut Butter',

          slug:
            'organic-peanut-butter',
        },

        brand: {
          _id:
            '64b000000000000000000005',

          name:
            'Example Brand',

          slug:
            'example-brand',

          logoUrl:
            '',
        },

        category: {
          _id:
            '64b000000000000000000006',

          name:
            'Nut Butters',

          slug:
            'nut-butters',
        },
      })

    assert.equal(
      product.slug,
      'organic-peanut-butter--crunchy--500g_jar',
    )

    assert.equal(
      product.brand.name,
      'Example Brand',
    )

    assert.equal(
      product.category.slug,
      'nut-butters',
    )
  },
)

test(
  'M04 public Product serializer does not expose administrative or commercial state',
  () => {
    const product =
      serializePublicProductRecord(
        {
          _id:
            '64b000000000000000000001',

          displayName:
            'Example Product',

          publicationStatus:
            'published',

          publishedByUserId:
            '64b000000000000000000009',

          createdByUserId:
            '64b000000000000000000008',

          provenance: [
            {
              fieldPath:
                'claims.vegan',
            },
          ],

          price:
            199,

          stock:
            42,

          hostId:
            '64b000000000000000000007',

          netQuantity: {
            value:
              500,

            unit:
              'g',
          },

          pack: {
            _id:
              '64b000000000000000000002',

            displayName:
              '500g Jar',

            packKey:
              '500g',

            packType:
              'jar',
          },

          variant: {
            _id:
              '64b000000000000000000003',

            canonicalName:
              'Original',

            variantKey:
              'original',
          },

          family: {
            _id:
              '64b000000000000000000004',

            canonicalName:
              'Example Family',

            slug:
              'example-family',
          },

          brand: {
            _id:
              '64b000000000000000000005',

            name:
              'Example Brand',

            slug:
              'example-brand',
          },

          category: {
            _id:
              '64b000000000000000000006',

            name:
              'Example Category',

            slug:
              'example-category',
          },
        },
        {
          detail:
            true,
        },
      )

    assert.equal(
      product.publicationStatus,
      undefined,
    )

    assert.equal(
      product.publishedByUserId,
      undefined,
    )

    assert.equal(
      product.createdByUserId,
      undefined,
    )

    assert.equal(
      product.provenance,
      undefined,
    )

    assert.equal(
      product.price,
      undefined,
    )

    assert.equal(
      product.stock,
      undefined,
    )

    assert.equal(
      product.hostId,
      undefined,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Public Routing
|--------------------------------------------------------------------------
*/

test(
  'M04 public Catalog router exposes Grocery Category Brand and Product routes without admin auth',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/catalog/catalog.public.routes.js',
          import.meta.url,
        ),
        'utf8',
      )

    assert.match(
      source,
      /'\/products'/,
    )

    assert.match(
      source,
      /'\/products\/:slug'/,
    )

    assert.match(
      source,
      /'\/categories'/,
    )

    assert.match(
      source,
      /'\/categories\/:slug\/products'/,
    )

    assert.match(
      source,
      /'\/brands'/,
    )

    assert.match(
      source,
      /'\/brands\/:slug\/products'/,
    )

    assert.doesNotMatch(
      source,
      /authenticateSession/,
    )

    assert.doesNotMatch(
      source,
      /requireAdminPermission/,
    )

    assert.doesNotMatch(
      source,
      /requireMfaAssurance/,
    )
  },
)

test(
  'M04 public Catalog router is mounted separately from admin Catalog APIs',
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
      /import catalogPublicRoutes from '\.\/modules\/catalog\/catalog\.public\.routes\.js'/,
    )

    assert.match(
      source,
      /app\.use\(\s*'\/api\/v1\/catalog',\s*catalogPublicRoutes,\s*\)/s,
    )

    assert.match(
      source,
      /app\.use\(\s*'\/api\/v1\/admin',[\s\S]*?adminRoutes,/,
    )
  },
)