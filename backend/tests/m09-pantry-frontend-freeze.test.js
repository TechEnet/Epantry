import assert from 'node:assert/strict'

import {
  readFile,
} from 'node:fs/promises'

import path from 'node:path'

import {
  fileURLToPath,
} from 'node:url'

import test from 'node:test'

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

test(
  'M09 frontend service exposes Household Pantry browse history observations and corrections',

  async () => {
    const source =
      await assertContains(
        'frontend/src/features/pantry/services/pantry.service.js',

        [
          "'/pantry'",
          "'/pantry/observations'",
          '/pantry/items/',
          '/history',
          "'/pantry/preferences'",
          'manual_quantity_correction',
          'finished',
          'bought_elsewhere',
          'storage_update',
          'do_not_track',
        ],
      )

    assert.match(
      source,

      /quantity:\s*{\s*mode:\s*['"]exact['"]/,
    )
  },
)

test(
  'M09 frontend Pantry mutations obtain CSRF challenge',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/features/pantry/services/pantry.service.js',
      )

    assert.match(
      source,

      /\/auth\/csrf/,
    )

    assert.match(
      source,

      /x-csrf-token/,
    )
  },
)

test(
  'M09 Recipe cooked frontend mutation carries explicit idempotency key',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/features/pantry/services/pantry.service.js',
      )

    assert.match(
      source,

      /\/recipes\/\$\{[\s\S]*?\}\/cooked/,
    )

    assert.match(
      source,

      /Idempotency-Key/,
    )

    assert.match(
      source,

      /idempotencyKey/,
    )
  },
)

test(
  'M09 Pantry badge visibly separates confirmed likely low uncertain out and untracked states',

  async () => {
    await assertContains(
      'frontend/src/features/pantry/components/PantryStateBadge.jsx',

      [
        'Confirmed',
        'Likely in pantry',
        'Running low',
        'Needs confirmation',
        'Out',
        'Bought elsewhere',
        'Not tracking',
      ],
    )
  },
)

test(
  'M09 Pantry customer UX does not expose raw confidence percentage as stock truth',

  async () => {
    const badgeSource =
      await readProjectFile(
        'frontend/src/features/pantry/components/PantryStateBadge.jsx',
      )

    const pageSource =
      await readProjectFile(
        'frontend/src/features/pantry/pages/PantryPage.jsx',
      )

    assert.doesNotMatch(
      badgeSource,

      /confidence\s*%|confidencePercentage|confidencePercent/i,
    )

    assert.doesNotMatch(
      pageSource,

      /confidence\s*%|confidencePercentage|confidencePercent/i,
    )
  },
)

test(
  'M09 P14 Living Pantry explains observations instead of warehouse stock',

  async () => {
    await assertContains(
      'frontend/src/features/pantry/pages/PantryPage.jsx',

      [
        'Living Pantry',
        'Your household food memory',
        'not a live warehouse stock counter',
        'Confirmed',
        'Likely',
        'Running low',
        'Needs confirmation',
        'Not tracking',
      ],
    )
  },
)

test(
  'M09 P15 Pantry history exposes correction surfaces without destructive history editing',

  async () => {
    const source =
      await assertContains(
        'frontend/src/features/pantry/pages/PantryItemHistoryPage.jsx',

        [
          'Pantry item history',
          'Observation history',
          'Correct exact quantity',
          'Finished',
          'Bought elsewhere',
          'Do not track',
          'Update storage',
        ],
      )

    assert.doesNotMatch(
      source,

      /deletePantryObservation|DELETE\s+\/pantry/i,
    )
  },
)

test(
  'M09 Recipe Detail bridge exposes reconciliation I have this and I cooked this',

  async () => {
    await assertContains(
      'frontend/src/features/pantry/components/RecipePantryBridge.jsx',

      [
        'getRecipePantry',
        'confirmIHaveThis',
        'recordRecipeCooked',
        'I have this',
        'I cooked this',
        'Can I cook this from home?',
      ],
    )
  },
)

test(
  'M09 Recipe Pantry bridge loads only for authenticated Customer capability',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/features/pantry/components/RecipePantryBridge.jsx',
      )

    assert.match(
      source,

      /isAuthenticated/,
    )

    assert.match(
      source,

      /customerEnabled/,
    )

    assert.doesNotMatch(
      source,

      /hostEnabled|superAdminEnabled/,
    )
  },
)

test(
  'M09 frontend exposes P14 and P15 only through Customer application access',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,

      /['"]\/pantry['"]/,
    )

    assert.match(
      source,

      /['"]\/pantry\/items\/:itemId['"]/,
    )

    assert.match(
      source,

      /APPLICATION_ACCESS_TYPES\.CUSTOMER/,
    )

    assert.match(
      source,

      /<PantryPage\s*\/>/,
    )

    assert.match(
      source,

      /<PantryItemHistoryPage\s*\/>/,
    )
  },
)

test(
  'M09 frontend keeps Recipe public page and composes Pantry as a bridge',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,

      /<RecipeDetailPage\s*\/>/,
    )

    assert.match(
      source,

      /<RecipePantryBridge\s*\/>/,
    )

    assert.match(
      source,

      /['"]\/recipes\/:slug['"]/,
    )

    assert.doesNotMatch(
      source,

      /ApplicationAccessRoute[\s\S]{0,300}<RecipeDetailPage/,
    )
  },
)

test(
  'M09 frontend preserves frozen M07 Recipe discovery history and What Should We Cook routes',

  async () => {
    await assertContains(
      'frontend/src/routes/AppRoutes.jsx',

      [
        '/recipes',
        '/recipes/:slug',
        '/recipes/:slug/history',
        '/recipes/what-should-we-cook',
        'RecipeDetailPage',
        'RecipeHistoryPage',
        'WhatShouldWeCookPage',
      ],
    )
  },
)

test(
  'M09 frontend preserves M08 Product and Recipe Food Intelligence bridges',

  async () => {
    await assertContains(
      'frontend/src/routes/AppRoutes.jsx',

      [
        'ProductFoodIntelligenceBridge',
        'RecipeFoodIntelligenceBridge',
        '/admin/food-intelligence',
      ],
    )
  },
)

test(
  'M09 frontend preserves Host Marketplace and Brand Authority routes',

  async () => {
    await assertContains(
      'frontend/src/routes/AppRoutes.jsx',

      [
        '/host/marketplace',
        '/host/brands',
        '/admin/marketplace',
        '/admin/brands',
      ],
    )
  },
)

test(
  'M09 Pantry frontend does not create Marketplace commercial dependency',

  async () => {
    const files = [
      'frontend/src/features/pantry/services/pantry.service.js',
      'frontend/src/features/pantry/components/PantryStateBadge.jsx',
      'frontend/src/features/pantry/components/RecipePantryBridge.jsx',
      'frontend/src/features/pantry/pages/PantryPage.jsx',
      'frontend/src/features/pantry/pages/PantryItemHistoryPage.jsx',
    ]

    for (
      const file
      of files
    ) {
      const source =
        await readProjectFile(
          file,
        )

      assert.doesNotMatch(
        source,

        /features\/marketplace|\/marketplace\/|sellerOffers|serviceability|inventorySnapshot/i,

        `${file} must not depend on Marketplace commercial truth.`,
      )
    }
  },
)

test(
  'M09 Pantry frontend does not create M10 Outcome Plan or requirement basket truth',

  async () => {
    const files = [
      'frontend/src/features/pantry/services/pantry.service.js',
      'frontend/src/features/pantry/components/RecipePantryBridge.jsx',
      'frontend/src/features/pantry/pages/PantryPage.jsx',
      'frontend/src/features/pantry/pages/PantryItemHistoryPage.jsx',
    ]

    for (
      const file
      of files
    ) {
      const source =
        await readProjectFile(
          file,
        )

      assert.doesNotMatch(
        source,

        /OutcomePlan|RequirementBasket|outcome-plans|basket-optimize|nextBasket/i,

        `${file} must remain inside M09 Pantry scope.`,
      )
    }
  },
)

test(
  'M09 routes never use presentation mode as authorization',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/routes/AppRoutes.jsx',
      )

    const forbiddenTerm =
      [
        'active',
        'Mode',
      ].join(
        '',
      )

    assert.equal(
      source.includes(
        forbiddenTerm,
      ),

      false,
    )
  },
)

test(
  'M09 Pantry access does not grant Super Admin implicit household bypass',

  async () => {
    const source =
      await readProjectFile(
        'frontend/src/routes/AppRoutes.jsx',
      )

    const pantryRouteMatch =
      /path\s*=\s*["']\/pantry["']/.exec(
        source,
      )

    assert.notEqual(
      pantryRouteMatch,
      null,
    )

    const pantryRouteIndex =
      pantryRouteMatch.index

    const pantrySection =
      source.slice(
        pantryRouteIndex,
        pantryRouteIndex +
          1800,
      )

    assert.match(
      pantrySection,

      /APPLICATION_ACCESS_TYPES\.CUSTOMER/,
    )

    assert.doesNotMatch(
      pantrySection,

      /APPLICATION_ACCESS_TYPES\.SUPER_ADMIN/,
    )
  },
)