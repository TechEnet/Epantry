import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  createHostPriceRuleSchema,
} from '../src/modules/marketplace/marketplace.pricing.validation.js'

import {
  buildEffectivePriceRuleFilter,
  resolvePriceRuleLifecycle,
  selectEffectivePriceRule,
  serializePriceRule,
} from '../src/modules/marketplace/marketplace.pricing.service.js'

/*
|--------------------------------------------------------------------------
| Route Source Helper
|--------------------------------------------------------------------------
|
| Extract actual Express route method + path registrations.
|
| This avoids false positives where a broad regex starts at an earlier
| router.patch() and continues across unrelated later routes.
|--------------------------------------------------------------------------
*/

function extractRouteRegistrations(
  source,
) {
  const routes =
    []

  const expression =
    /router\.(get|post|patch|delete)\(\s*'([^']+)'/g

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

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

test(
  'M05 pricing accepts valid effective-dated INR commercial price',
  () => {
    const result =
      createHostPriceRuleSchema.safeParse({
        listPrice: {
          amountMinor:
            12000,

          currency:
            'INR',
        },

        salePrice: {
          amountMinor:
            9999,

          currency:
            'INR',
        },

        effectiveFrom:
          '2026-08-22T10:00:00.000Z',

        changeReason:
          'Launch commercial price.',
      })

    assert.equal(
      result.success,
      true,
    )
  },
)

test(
  'M05 pricing rejects floating point minor-unit amount',
  () => {
    const result =
      createHostPriceRuleSchema.safeParse({
        listPrice: {
          amountMinor:
            9999.5,

          currency:
            'INR',
        },

        effectiveFrom:
          '2026-08-22T10:00:00.000Z',

        changeReason:
          'Invalid price.',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 pricing rejects sale price above list price',
  () => {
    const result =
      createHostPriceRuleSchema.safeParse({
        listPrice: {
          amountMinor:
            10000,

          currency:
            'INR',
        },

        salePrice: {
          amountMinor:
            12000,

          currency:
            'INR',
        },

        effectiveFrom:
          '2026-08-22T10:00:00.000Z',

        changeReason:
          'Invalid sale price.',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 pricing requires explicit price change reason',
  () => {
    const result =
      createHostPriceRuleSchema.safeParse({
        listPrice: {
          amountMinor:
            10000,

          currency:
            'INR',
        },

        effectiveFrom:
          '2026-08-22T10:00:00.000Z',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

test(
  'M05 pricing rejects reversed effective date window',
  () => {
    const result =
      createHostPriceRuleSchema.safeParse({
        listPrice: {
          amountMinor:
            10000,

          currency:
            'INR',
        },

        effectiveFrom:
          '2026-08-23T10:00:00.000Z',

        effectiveTo:
          '2026-08-22T10:00:00.000Z',

        changeReason:
          'Invalid effective dates.',
      })

    assert.equal(
      result.success,
      false,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Deterministic Effective Price
|--------------------------------------------------------------------------
*/

test(
  'M05 effective price resolver chooses newest applicable effective-date rule',
  () => {
    const result =
      selectEffectivePriceRule(
        [
          {
            id:
              'old',

            status:
              'active',

            effectiveFrom:
              '2026-08-01T00:00:00.000Z',

            effectiveTo:
              null,

            listPrice: {
              amountMinor:
                10000,

              currency:
                'INR',
            },
          },

          {
            id:
              'new',

            status:
              'active',

            effectiveFrom:
              '2026-08-20T00:00:00.000Z',

            effectiveTo:
              null,

            listPrice: {
              amountMinor:
                9000,

              currency:
                'INR',
            },
          },
        ],
        '2026-08-22T00:00:00.000Z',
      )

    assert.equal(
      result.id,
      'new',
    )
  },
)

test(
  'M05 effective price resolver ignores future price before effectiveFrom',
  () => {
    const result =
      selectEffectivePriceRule(
        [
          {
            id:
              'current',

            status:
              'active',

            effectiveFrom:
              '2026-08-01T00:00:00.000Z',

            effectiveTo:
              null,
          },

          {
            id:
              'future',

            status:
              'scheduled',

            effectiveFrom:
              '2026-09-01T00:00:00.000Z',

            effectiveTo:
              null,
          },
        ],
        '2026-08-22T00:00:00.000Z',
      )

    assert.equal(
      result.id,
      'current',
    )
  },
)

test(
  'M05 effective price resolver ignores expired price',
  () => {
    const result =
      selectEffectivePriceRule(
        [
          {
            id:
              'expired',

            status:
              'active',

            effectiveFrom:
              '2026-08-01T00:00:00.000Z',

            effectiveTo:
              '2026-08-10T00:00:00.000Z',
          },
        ],
        '2026-08-22T00:00:00.000Z',
      )

    assert.equal(
      result,
      null,
    )
  },
)

test(
  'M05 effective price database filter is tenant and Offer scoped',
  () => {
    const at =
      new Date(
        '2026-08-22T00:00:00.000Z',
      )

    const filter =
      buildEffectivePriceRuleFilter({
        organizationId:
          'org-a',

        offerId:
          'offer-a',

        at,
      })

    assert.equal(
      filter.organizationId,
      'org-a',
    )

    assert.equal(
      filter.offerId,
      'offer-a',
    )

    assert.equal(
      filter.effectiveFrom.$lte,
      at,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Lifecycle + Freshness
|--------------------------------------------------------------------------
*/

test(
  'M05 price lifecycle reports scheduled active and expired by effective dates',
  () => {
    const at =
      new Date(
        '2026-08-22T00:00:00.000Z',
      )

    assert.equal(
      resolvePriceRuleLifecycle(
        {
          status:
            'scheduled',

          effectiveFrom:
            '2026-08-23T00:00:00.000Z',

          effectiveTo:
            null,
        },
        at,
      ),
      'scheduled',
    )

    assert.equal(
      resolvePriceRuleLifecycle(
        {
          status:
            'active',

          effectiveFrom:
            '2026-08-20T00:00:00.000Z',

          effectiveTo:
            null,
        },
        at,
      ),
      'active',
    )

    assert.equal(
      resolvePriceRuleLifecycle(
        {
          status:
            'active',

          effectiveFrom:
            '2026-08-01T00:00:00.000Z',

          effectiveTo:
            '2026-08-10T00:00:00.000Z',
        },
        at,
      ),
      'expired',
    )
  },
)

test(
  'M05 price serializer exposes recorded freshness actor source and reason',
  () => {
    const result =
      serializePriceRule({
        _id:
          'price-1',

        organizationId:
          'org-1',

        offerId:
          'offer-1',

        listPrice: {
          amountMinor:
            10000,

          currency:
            'INR',
        },

        salePrice: {
          amountMinor:
            9000,

          currency:
            'INR',
        },

        status:
          'active',

        effectiveFrom:
          '2026-08-20T00:00:00.000Z',

        effectiveTo:
          null,

        source:
          'manual',

        changeReason:
          'Promotional price.',

        createdByUserId:
          'user-1',

        createdAt:
          '2026-08-20T09:00:00.000Z',
      })

    assert.equal(
      result.effectivePrice.amountMinor,
      9000,
    )

    assert.equal(
      result.recordedAt,
      '2026-08-20T09:00:00.000Z',
    )

    assert.equal(
      result.createdByUserId,
      'user-1',
    )

    assert.equal(
      result.changeReason,
      'Promotional price.',
    )
  },
)

/*
|--------------------------------------------------------------------------
| Append-only API
|--------------------------------------------------------------------------
*/

test(
  'M05 Host Price API is append-only and exposes no price PATCH or DELETE endpoint',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.host.routes.js',
          import.meta.url,
        ),
        'utf8',
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

    assert.ok(
      routes.some(
        (
          route,
        ) =>
          route.method ===
            'get' &&
          route.path ===
            '/offers/:id/effective-price',
      ),
    )

    assert.equal(
      routes.some(
        (
          route,
        ) =>
          route.method ===
            'patch' &&
          route.path.startsWith(
            '/offers/:id/prices',
          ),
      ),
      false,
    )

    assert.equal(
      routes.some(
        (
          route,
        ) =>
          route.method ===
            'delete' &&
          route.path.startsWith(
            '/offers/:id/prices',
          ),
      ),
      false,
    )
  },
)

test(
  'M05 Host price mutation remains CSRF protected',
  () => {
    const source =
      fs.readFileSync(
        new URL(
          '../src/modules/marketplace/marketplace.host.routes.js',
          import.meta.url,
        ),
        'utf8',
      )

    const pricePostPosition =
      source.indexOf(
        "'/offers/:id/prices'",
        source.indexOf(
          'router.post',
        ),
      )

    assert.ok(
      pricePostPosition >
      0,
    )

    const beforePriceRoute =
      source.slice(
        Math.max(
          0,
          pricePostPosition -
            180,
        ),
        pricePostPosition +
          260,
      )

    assert.match(
      beforePriceRoute,
      /requireCsrfToken/,
    )
  },
)