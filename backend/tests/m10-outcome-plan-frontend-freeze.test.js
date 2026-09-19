import assert from 'node:assert/strict'

import fs from 'node:fs'

import path from 'node:path'

import test from 'node:test'

function readFrontend(
  relativePath,
) {
  return fs.readFileSync(
    path.resolve(
      process.cwd(),
      '../frontend',
      relativePath,
    ),
    'utf8',
  )
}

function assertRoute(
  source,
  routePath,
) {
  const escaped =
    routePath.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    )

  assert.match(
    source,

    new RegExp(
      `path\\s*=\\s*["']${escaped}["']`,
    ),
  )
}

test(
  'M10 frontend service exposes Outcome Plan create read and requirement mutation APIs',

  () => {
    const source =
      readFrontend(
        'src/features/outcomes/services/outcomePlan.service.js',
      )

    assert.match(
      source,

      /\/outcome-plans/,
    )

    assert.match(
      source,

      /\/recipes\/\$\{encodePathValue[\s\S]*?\}\/outcome-plan/,
    )

    assert.match(
      source,

      /\/requirements/,
    )
  },
)

test(
  'M10 frontend mutations obtain CSRF and explicit idempotency key',

  () => {
    const source =
      readFrontend(
        'src/features/outcomes/services/outcomePlan.service.js',
      )

    assert.match(
      source,

      /\/auth\/csrf/,
    )

    assert.match(
      source,

      /x-csrf-token/,
    )

    assert.match(
      source,

      /Idempotency-Key/,
    )
  },
)

test(
  'M10 Recipe bridge is available only to authenticated Customer capability',

  () => {
    const source =
      readFrontend(
        'src/features/outcomes/components/RecipeOutcomePlanBridge.jsx',
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

      /hostEnabled|superAdminEnabled|activeMode/,
    )
  },
)

test(
  'M10 Recipe bridge creates Outcome Plan without Product matching or checkout authority',

  () => {
    const source =
      readFrontend(
        'src/features/outcomes/components/RecipeOutcomePlanBridge.jsx',
      )

    assert.match(
      source,

      /createRecipeOutcomePlan/,
    )

    assert.match(
      source,

      /Create Outcome Plan/,
    )

    assert.doesNotMatch(
      source,

      /features\/marketplace|marketplace\.service|selectedOfferId|selectedProductId|checkout[A-Za-z]*\s*\(/i,
    )
  },
)

test(
  'M10 P18 Outcome Plan exposes documented requirement groups',

  () => {
    const source =
      readFrontend(
        'src/features/outcomes/pages/OutcomePlanPage.jsx',
      )

    for (
      const label
      of [
        'Needed',
        'Already Have',
        'Running Low',
        'Needs Confirmation',
        'Optional Upgrade',
      ]
    ) {
      assert.match(
        source,

        new RegExp(
          label,
        ),
      )
    }
  },
)

test(
  'M10 P18 explains genuine shortage instead of treating Pantry confidence as exact stock',

  () => {
    const source =
      readFrontend(
        'src/features/outcomes/pages/OutcomePlanPage.jsx',
      )

    assert.match(
      source,

      /Genuine missing/,
    )

    assert.match(
      source,

      /Needs confirmation/,
    )

    assert.doesNotMatch(
      source,

      /confidence\s*%|confidencePercentage|confidencePercent/i,
    )
  },
)

test(
  'M10 serving change uses server-side requirement recalculation',

  () => {
    const source =
      readFrontend(
        'src/features/outcomes/pages/OutcomePlanPage.jsx',
      )

    assert.match(
      source,

      /updateOutcomePlanRequirements/,
    )

    assert.match(
      source,

      /targetServings/,
    )

    assert.match(
      source,

      /Recalculate/,
    )
  },
)

test(
  'M10 optional upgrades require explicit include or exclude decision',

  () => {
    const source =
      readFrontend(
        'src/features/outcomes/pages/OutcomePlanPage.jsx',
      )

    assert.match(
      source,

      /include_optional/,
    )

    assert.match(
      source,

      /exclude_optional/,
    )

    assert.match(
      source,

      /Include upgrade/,
    )
  },
)

test(
  'M10 P20 Requirement Basket remains requirement-first and not a Product cart',

  () => {
    const source =
      readFrontend(
        'src/features/outcomes/pages/OutcomePlanPage.jsx',
      )

    assert.match(
      source,

      /P20 · Requirement Basket/,
    )

    assert.match(
      source,

      /Add missing to Requirement Basket/,
    )

    assert.match(
      source,

      /requirement basket, not a product cart/i,
    )

    assert.doesNotMatch(
      source,

      /features\/marketplace|marketplace\.service|selectedOfferId|selectedProductId/i,
    )
  },
)

test(
  'M10 frontend exposes P18 and P20 only through Customer application access',

  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assertRoute(
      source,

      '/outcome-plans/:planId',
    )

    assertRoute(
      source,

      '/outcome-plans/:planId/basket',
    )

    const outcomeStart =
      source.indexOf(
        'path="/outcome-plans/:planId"',
      ) >= 0
        ? source.indexOf(
            'path="/outcome-plans/:planId"',
          )
        : source.indexOf(
            "path='/outcome-plans/:planId'",
          )

    assert.notEqual(
      outcomeStart,

      -1,
    )

    const outcomeSection =
      source.slice(
        outcomeStart,

        outcomeStart +
          1800,
      )

    assert.match(
      outcomeSection,

      /APPLICATION_ACCESS_TYPES\.CUSTOMER/,
    )

    assert.doesNotMatch(
      outcomeSection,

      /APPLICATION_ACCESS_TYPES\.SUPER_ADMIN/,
    )
  },
)

test(
  'M10 preserves public M07 Recipe page and composes Outcome Plan as a bridge',

  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assertRoute(
      source,

      '/recipes/:slug',
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

      /<RecipeOutcomePlanBridge\s*\/>/,
    )
  },
)

test(
  'M10 routes do not use activeMode as authorization',

  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assert.doesNotMatch(
      source,

      /activeMode/,
    )
  },
)

test(
  'M10 frontend creates no Seller Brand B2B top-level authority',

  () => {
    const source =
      [
        readFrontend(
          'src/features/outcomes/services/outcomePlan.service.js',
        ),

        readFrontend(
          'src/features/outcomes/components/RecipeOutcomePlanBridge.jsx',
        ),

        readFrontend(
          'src/features/outcomes/pages/OutcomePlanPage.jsx',
        ),
      ].join(
        '\n',
      )

    assert.doesNotMatch(
      source,

      /sellerEnabled|brandEnabled|b2bEnabled|APPLICATION_ACCESS_TYPES\.(SELLER|BRAND|B2B)/,
    )
  },
)