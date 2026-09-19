import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  buildBrandWorldProductSlug,
  serializePublicBrandVersionHistory,
} from '../src/modules/brands/brandAuthority.public.service.js'

import {
  listPublicBrandsQuerySchema,
  publicBrandHistoryParamsSchema,
} from '../src/modules/brands/brandAuthority.public.validation.js'

function readSource(
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

test(
  'M06 Public Brand Directory accepts bounded browse query',
  () => {
    const result =
      listPublicBrandsQuerySchema.safeParse({
        page:
          '1',

        limit:
          '24',

        search:
          'Amul',
      })

    assert.equal(
      result.success,
      true,
    )

    assert.equal(
      result.data.page,
      1,
    )
  },
)

test(
  'M06 Public Product history requires canonical Pack identity',
  () => {
    const result =
      publicBrandHistoryParamsSchema.safeParse({
        brandKey:
          'amul',

        packId:
          '64e000000000000000000001',
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M06 Brand World Product slug follows existing canonical family variant pack identity',
  () => {
    assert.equal(
      buildBrandWorldProductSlug({
        family: {
          slug:
            'amul-butter',
        },

        variant: {
          variantKey:
            'salted',
        },

        pack: {
          packKey:
            '100g',
        },
      }),
      'amul-butter--salted--100g',
    )
  },
)

test(
  'M06 Public history serializer does not expose administrative actor identity',
  () => {
    const result =
      serializePublicBrandVersionHistory({
        _id:
          'version-a',

        versionNumber:
          2,

        status:
          'retired',

        changeReason:
          'Packaging updated.',

        createdByUserId:
          'private-user',

        reviewedByUserId:
          'private-reviewer',
      })

    assert.equal(
      Object.hasOwn(
        result,
        'createdByUserId',
      ),
      false,
    )

    assert.equal(
      Object.hasOwn(
        result,
        'reviewedByUserId',
      ),
      false,
    )
  },
)

test(
  'M06 Brand World uses canonical M04 Brand Family Variant Pack ProductVersion graph',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.public.service.js',
      )

    assert.match(
      source,
      /Brand\.find/,
    )

    assert.match(
      source,
      /ProductFamily\.find/,
    )

    assert.match(
      source,
      /ProductVariant\.find/,
    )

    assert.match(
      source,
      /Pack\.find/,
    )

    assert.match(
      source,
      /ProductVersion\.find/,
    )
  },
)

test(
  'M06 Brand World resolves current Product truth using existing published Pack filter',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.public.service.js',
      )

    assert.match(
      source,
      /buildCurrentPublishedPackVersionFilter/,
    )
  },
)

test(
  'M06 Public Brand history exposes only published and retired historical Product versions',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.public.service.js',
      )

    assert.match(
      source,
      /'published'/,
    )

    assert.match(
      source,
      /'retired'/,
    )
  },
)

test(
  'M06 Public Brand verification comes from active effective BrandAuthorityGrant',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.public.service.js',
      )

    assert.match(
      source,
      /BrandAuthorityGrant\.find/,
    )

    assert.match(
      source,
      /status:\s*'active'/,
    )

    assert.match(
      source,
      /validFrom/,
    )

    assert.match(
      source,
      /validUntil/,
    )
  },
)

test(
  'M06 Public Brand router is read-only and unauthenticated',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.public.routes.js',
      )

    assert.match(
      source,
      /router\.get/,
    )

    assert.doesNotMatch(
      source,
      /router\.(post|patch|delete)/,
    )

    assert.doesNotMatch(
      source,
      /authenticateSession/,
    )
  },
)

test(
  'M06 Public Brand World does not compose M05 price inventory or serviceability state',
  () => {
    const source =
      readSource(
        'modules/brands/brandAuthority.public.service.js',
      )

    assert.doesNotMatch(
      source,
      /PriceRule|InventorySnapshot|ServiceArea|HostOffer/,
    )
  },
)