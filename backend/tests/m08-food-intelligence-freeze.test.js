import assert from 'node:assert/strict'

import fs from 'node:fs'

import path from 'node:path'

import test from 'node:test'

function readBackend(
  relativePath,
) {
  return fs.readFileSync(
    path.resolve(
      process.cwd(),
      relativePath,
    ),
    'utf8',
  )
}

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

/*
|--------------------------------------------------------------------------
| Source Assertion Helpers
|--------------------------------------------------------------------------
|
| Source freeze tests verify contracts, not formatter preferences.
|
| Valid JavaScript / JSX may use either:
|
| 'value'
|
| or:
|
| "value"
|
| These helpers intentionally accept both quote styles while preserving
| the exact route, permission, and application-access contracts.
|
*/

function assertQuotedLiteral(
  source,
  literal,
) {
  const escaped =
    literal.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    )

  assert.match(
    source,
    new RegExp(
      `["']${escaped}["']`,
    ),
  )
}

function assertJsxRoute(
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
  'M08 freeze mounts public Food Intelligence under API v1',
  () => {
    const source =
      readBackend(
        'src/app.js',
      )

    assert.match(
      source,
      /foodIntelligencePublicRoutes/,
    )

    assert.match(
      source,
      /'\/api\/v1'/,
    )
  },
)

test(
  'M08 freeze keeps privileged Food governance under Admin surface',
  () => {
    const source =
      readBackend(
        'src/app.js',
      )

    assert.match(
      source,
      /foodIntelligenceAdminRoutes/,
    )

    assert.match(
      source,
      /foodIntelligenceWorkspaceRoutes/,
    )
  },
)

test(
  'M08 Admin Food workspace requires session active account and MFA',
  () => {
    const source =
      readBackend(
        'src/modules/foodIntelligence/foodIntelligence.workspace.routes.js',
      )

    assert.match(
      source,
      /authenticateSession/,
    )

    assert.match(
      source,
      /requireActiveAccount/,
    )

    assert.match(
      source,
      /requireMfaAssurance/,
    )
  },
)

test(
  'M08 Admin Food workspace rejects privileged impersonation',
  () => {
    const source =
      readBackend(
        'src/modules/foodIntelligence/foodIntelligence.workspace.routes.js',
      )

    assert.match(
      source,
      /rejectPrivilegedImpersonation/,
    )
  },
)

test(
  'M08 Admin Food workspace uses existing Catalog Recipe or Trust Safety read permissions',
  () => {
    const source =
      readBackend(
        'src/modules/foodIntelligence/foodIntelligence.workspace.routes.js',
      )

    assertQuotedLiteral(
      source,
      'catalog.read',
    )

    assertQuotedLiteral(
      source,
      'recipe.read',
    )

    assertQuotedLiteral(
      source,
      'trust_safety.read',
    )
  },
)

test(
  'M08 frontend service exposes documented public Product and Recipe Food APIs',
  () => {
    const source =
      readFrontend(
        'src/features/foodIntelligence/services/foodIntelligence.service.js',
      )

    assert.match(
      source,
      /\/products\/\$\{encodePathValue/,
    )

    assert.match(
      source,
      /\/recipes\/\$\{encodePathValue/,
    )

    assert.match(
      source,
      /food-intelligence/,
    )
  },
)

test(
  'M08 frontend privileged Food writes obtain CSRF challenge',
  () => {
    const source =
      readFrontend(
        'src/features/foodIntelligence/services/foodIntelligence.service.js',
      )

    assert.match(
      source,
      /'\/auth\/csrf'/,
    )

    assert.match(
      source,
      /'x-csrf-token'/,
    )
  },
)

test(
  'M08 Customer safety panel contains explicit Cannot verify state',
  () => {
    const source =
      readFrontend(
        'src/features/foodIntelligence/components/FoodIntelligencePanel.jsx',
      )

    assert.match(
      source,
      /Cannot verify/,
    )
  },
)

test(
  'M08 Customer safety panel contains Nutrition Allergens and Dietary sections',
  () => {
    const source =
      readFrontend(
        'src/features/foodIntelligence/components/FoodIntelligencePanel.jsx',
      )

    assert.match(
      source,
      /title="Nutrition"/,
    )

    assert.match(
      source,
      /title="Allergens"/,
    )

    assert.match(
      source,
      /title="Dietary"/,
    )
  },
)

test(
  'M08 Customer safety panel never labels empty allergen list as free from',
  () => {
    const source =
      readFrontend(
        'src/features/foodIntelligence/components/FoodIntelligencePanel.jsx',
      )

    assert.match(
      source,
      /Absence is not treated as a free-from claim/,
    )
  },
)

test(
  'M08 Customer panel exposes progressive calculation lineage disclosure',
  () => {
    const source =
      readFrontend(
        'src/features/foodIntelligence/components/FoodIntelligencePanel.jsx',
      )

    assert.match(
      source,
      /<details/,
    )

    assert.match(
      source,
      /Calculation source & rule lineage/,
    )
  },
)

test(
  'M08 Product Detail is extended by bridge instead of replacing frozen Product page',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /ProductDetailPage/,
    )

    assert.match(
      source,
      /ProductFoodIntelligenceBridge/,
    )

    assertJsxRoute(
      source,
      '/grocery/product/:slug',
    )
  },
)

test(
  'M08 Recipe Detail is extended by bridge while preserving M07 Recipe page',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /RecipeDetailPage/,
    )

    assert.match(
      source,
      /RecipeFoodIntelligenceBridge/,
    )

    assertJsxRoute(
      source,
      '/recipes/:slug',
    )
  },
)

test(
  'M08 freeze preserves M07 What Should We Cook and Recipe history routes',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assertJsxRoute(
      source,
      '/recipes/what-should-we-cook',
    )

    assertJsxRoute(
      source,
      '/recipes/:slug/history',
    )
  },
)

test(
  'M08 frontend exposes Food Intelligence admin route with existing read permissions',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assertJsxRoute(
      source,
      '/admin/food-intelligence',
    )

    assertQuotedLiteral(
      source,
      'catalog.read',
    )

    assertQuotedLiteral(
      source,
      'recipe.read',
    )

    assertQuotedLiteral(
      source,
      'trust_safety.read',
    )
  },
)

test(
  'M08 Admin Shell preserves Recipe Management and adds Food Intelligence',
  () => {
    const source =
      readFrontend(
        'src/features/admin/components/AdminShell.jsx',
      )

    assert.match(
      source,
      /Recipe Management/,
    )

    assert.match(
      source,
      /Food Intelligence/,
    )

    assert.match(
      source,
      /'\/admin\/food-intelligence'/,
    )
  },
)

test(
  'M08 freeze preserves Host Marketplace and Brand Authority routes',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assertJsxRoute(
      source,
      '/host/marketplace',
    )

    assertJsxRoute(
      source,
      '/host/brands',
    )
  },
)

test(
  'M08 does not introduce Food Brand Seller B2B or Recipe as application access types',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /CUSTOMER:\s*[\r\n\s]*["']customer["']/,
    )

    assert.match(
      source,
      /HOST:\s*[\r\n\s]*["']host["']/,
    )

    assert.match(
      source,
      /SUPER_ADMIN:\s*[\r\n\s]*["']super_admin["']/,
    )

    assert.doesNotMatch(
      source,
      /FOOD:\s*|BRAND:\s*|SELLER:\s*|B2B:\s*|RECIPE:\s*/,
    )
  },
)