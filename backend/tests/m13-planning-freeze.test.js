import assert from 'node:assert/strict'

import {
  readFile,
} from 'node:fs/promises'

import path from 'node:path'

import test from 'node:test'

import {
  fileURLToPath,
} from 'node:url'

const currentFile =
  fileURLToPath(
    import.meta.url,
  )

const backendRoot =
  path.resolve(
    path.dirname(
      currentFile,
    ),
    '..',
  )

const projectRoot =
  path.resolve(
    backendRoot,
    '..',
  )

async function readProjectFile(
  relativePath,
) {
  return readFile(
    path.resolve(
      projectRoot,
      relativePath,
    ),
    'utf8',
  )
}

async function assertContains(
  relativePath,
  expectedValues,
) {
  const source =
    await readProjectFile(
      relativePath,
    )

  for (
    const expected
    of expectedValues
  ) {
    assert.equal(
      source.includes(
        expected,
      ),
      true,
      `${relativePath} must contain ${expected}`,
    )
  }

  return source
}

function stripJsComments(
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

test(
  'M13 Final mounts private planning and Waste Reduction API surfaces',

  async () => {
    const source =
      await readProjectFile(
        'backend/src/app.js',
      )

    assert.match(
      source,
      /planningRoutes/,
    )

    assert.match(
      source,
      /planningWasteRoutes/,
    )

    assert.match(
      source,
      /sensitiveResponseNoStoreMiddleware[\s\S]*?planningRoutes/,
    )

    assert.match(
      source,
      /sensitiveResponseNoStoreMiddleware[\s\S]*?planningWasteRoutes/,
    )
  },
)

test(
  'M13 Final planning authorization is Customer capability based and never activeMode based',

  async () => {
    const files = [
      'backend/src/modules/planning/planning.routes.js',
      'backend/src/modules/planning/planning.waste.routes.js',
    ]

    for (
      const file
      of files
    ) {
      const source =
        stripJsComments(
          await readProjectFile(
            file,
          ),
        )

      for (
        const required
        of [
          'authenticateSession',
          'loadCurrentUser',
          'requireActiveAccount',
          'requireCustomerAccess',
        ]
      ) {
        assert.match(
          source,
          new RegExp(
            required,
          ),
        )
      }

      assert.doesNotMatch(
        source,
        /activeMode/,
      )

      assert.doesNotMatch(
        source,
        /sellerEnabled|brandEnabled|b2bEnabled|sellerRole|brandRole|b2bRole/i,
      )
    }
  },
)

test(
  'M13 Final planning mutations remain CSRF protected',

  async () => {
    const source =
      await readProjectFile(
        'backend/src/modules/planning/planning.routes.js',
      )

    assert.match(
      source,
      /requireCsrfToken/,
    )

    for (
      const route
      of [
        '/meal-plans',
        '/planned-meals/:id',
        '/next-basket/:id/feedback',
        '/next-basket/preferences',
      ]
    ) {
      assert.equal(
        source.includes(
          route,
        ),
        true,
      )
    }
  },
)

test(
  'M13 Final Waste Reduction API is read-only and Customer protected',

  async () => {
    const source =
      stripJsComments(
        await readProjectFile(
          'backend/src/modules/planning/planning.waste.routes.js',
        ),
      )

    assert.match(
      source,
      /['"]\/waste-reduction['"]/,
    )

    assert.match(
      source,
      /['"]\/next-possibility['"]/,
    )

    assert.match(
      source,
      /planningWasteRoutes\.get/,
    )

    assert.doesNotMatch(
      source,
      /planningWasteRoutes\.(?:post|patch|put|delete)/,
    )
  },
)

test(
  'M13 Final Waste Reduction never converts household use-soon into verified expiry truth',

  async () => {
    const source =
      await readProjectFile(
        'backend/src/modules/planning/planning.waste.service.js',
      )

    await assertContains(
      'backend/src/modules/planning/planning.waste.service.js',

      [
        'customerUseSoonIsNotExpiry',
        'inferredExpiryDates',
        'inferredSpoilage',
        'inventedQuantities',
        'expiryDateClaimed',
        'spoilageClaimed',
      ],
    )

    assert.match(
      source,
      /customerUseSoonIsNotExpiry:\s*true/,
    )

    assert.match(
      source,
      /inferredExpiryDates:\s*false/,
    )

    assert.match(
      source,
      /inferredSpoilage:\s*false/,
    )

    assert.match(
      source,
      /inventedQuantities:\s*false/,
    )
  },
)

test(
  'M13 Final exact Waste quantities require proven exact Pantry evidence',

  async () => {
    const source =
      await readProjectFile(
        'backend/src/modules/planning/planning.waste.service.js',
      )

    assert.match(
      source,
      /CONFIRMED_EXACT_PANTRY_STATES/,
    )

    assert.match(
      source,
      /quantity\?\.mode !== 'exact'/,
    )

    assert.match(
      source,
      /CONFIRMED_EXACT_MINUS_ACTIVE_PLANNING_RESERVATIONS/,
    )

    assert.match(
      source,
      /PantryReservation/,
    )
  },
)

test(
  'M13 Final Next Possibility uses current published Recipe truth only',

  async () => {
    const source =
      await readProjectFile(
        'backend/src/modules/planning/planning.waste.service.js',
      )

    assert.match(
      source,
      /status:\s*'published'/,
    )

    assert.match(
      source,
      /unsafeIncomplete:\s*{[\s\S]*?\$ne:\s*true/,
    )

    assert.match(
      source,
      /effectiveFrom/,
    )

    assert.match(
      source,
      /effectiveTo/,
    )
  },
)

test(
  'M13 Final recommendation domain cannot silently mutate commerce truth',

  async () => {
    const files = [
      'backend/src/modules/planning/planning.service.js',
      'backend/src/modules/planning/planning.waste.service.js',
      'backend/src/modules/planning/planning.routes.js',
      'backend/src/modules/planning/planning.waste.routes.js',
    ]

    for (
      const file
      of files
    ) {
      const source =
        stripJsComments(
          await readProjectFile(
            file,
          ),
        )

      assert.doesNotMatch(
        source,
        /createCart|createCheckout|createOrder|createPaymentIntent|capturePayment|updateInventorySnapshot/,
        `${file} must not gain silent commerce mutation authority.`,
      )
    }
  },
)

test(
  'M13 Final frontend service exposes Meal Plan Next Basket Waste Reduction and Next Possibility APIs',

  async () => {
    await assertContains(
      'frontend/src/features/planning/services/planning.service.js',

      [
        '/meal-plans',
        '/planned-meals/',
        '/next-basket',
        '/waste-reduction',
        '/next-possibility',
        '/auth/csrf',
        'x-csrf-token',
      ],
    )
  },
)

test(
  'M13 Final customer UX routes are Customer capability gated',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/routes/AppRoutes.jsx',
      )

    for (
      const route
      of [
        '/meal-plan',
        '/next-basket',
        '/waste-reduction',
        '/next-possibility',
      ]
    ) {
      const index =
        source.indexOf(
          `path="${route}"`,
        )

      assert.notEqual(
        index,
        -1,
        `${route} must be registered.`,
      )

      const section =
        source.slice(
          index,
          index +
            650,
        )

      assert.match(
        section,
        /APPLICATION_ACCESS_TYPES\.CUSTOMER/,
      )

      assert.doesNotMatch(
        section,
        /APPLICATION_ACCESS_TYPES\.(?:HOST|SUPER_ADMIN)/,
      )
    }
  },
)

test(
  'M13 Final frontend keeps exactly Customer Host and Super Admin top-level access types',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/routes/AppRoutes.jsx',
      )

    await assertContains(
      'frontend/src/routes/AppRoutes.jsx',

      [
        "CUSTOMER:\n      'customer'",
        "HOST:\n      'host'",
        "SUPER_ADMIN:\n      'super_admin'",
      ],
    )

    assert.doesNotMatch(
      source,
      /APPLICATION_ACCESS_TYPES\.(?:SELLER|BRAND|B2B)/,
    )
  },
)

test(
  'M13 Final Host authorization requires enabled and active status',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /hostEnabled\s*===\s*true[\s\S]*?hostAccessStatus\s*===\s*'active'/,
    )
  },
)

test(
  'M13 Final Waste UX labels use-soon as household evidence and exposes correction loop',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/features/planning/pages/WasteReductionPage.jsx',
      )

    await assertContains(
      'frontend/src/features/planning/pages/WasteReductionPage.jsx',

      [
        'Waste Reduction + Next Possibility',
        'household use-soon date is',
        'not treated as a verified expiry date',
        'Review / correct Pantry evidence',
        'Correct Pantry evidence',
        'Next Possibility',
        'Open Next Basket feedback',
        'does not claim a verified expiry date',
      ],
    )

    assert.doesNotMatch(
      stripJsComments(
        source,
      ),
      /expires on|expiry date:\s*\{|expired because/i,
    )
  },
)

test(
  'M13 Final Next Basket keeps explicit feedback and no automatic Cart promise',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/features/planning/pages/NextBasketPage.jsx',
      )

    await assertContains(
      'frontend/src/features/planning/pages/NextBasketPage.jsx',

      [
        'Accept suggestion',
        'Still have',
        'Bought elsewhere',
        'Snooze 7d',
        'Remove',
        'Stop suggesting',
        'automatically create a Cart',
      ],
    )

    assert.doesNotMatch(
      source,
      /createCart\(|createCheckout\(|createOrder\(/,
    )
  },
)

test(
  'M13 Final preserves M09 to M12 frozen route surfaces',

  async () => {
    const routes =
      await readProjectFile(
        'frontend/src/routes/AppRoutes.jsx',
      )

    for (
      const preserved
      of [
        '/pantry',
        '/pantry/items/:itemId',
        '/outcome-plans/:planId',
        '/cart/:cartId',
        '/checkout/:cartId',
        '/orders',
        '/search',
        '/admin',
      ]
    ) {
      assert.equal(
        routes.includes(
          preserved,
        ),
        true,
        `M09-M12 route ${preserved} must remain frozen.`,
      )
    }
  },
)