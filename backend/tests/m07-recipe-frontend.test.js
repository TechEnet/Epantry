import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

function readFrontend(
  relativePath,
) {
  return fs.readFileSync(
    new URL(
      `../../frontend/src/${relativePath}`,
      import.meta.url,
    ),
    'utf8',
  )
}

function stripComments(
  source,
) {
  return source
    .replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    .replace(
      /\/\/.*$/gm,
      '',
    )
}

test(
  'M07 frontend service exposes public Recipe browse detail history scale and matcher APIs',
  () => {
    const source =
      readFrontend(
        'features/recipes/services/recipe.service.js',
      )

    assert.match(
      source,
      /listPublicRecipes/,
    )

    assert.match(
      source,
      /getPublicRecipe/,
    )

    assert.match(
      source,
      /getPublicRecipeHistory/,
    )

    assert.match(
      source,
      /scalePublicRecipe/,
    )

    assert.match(
      source,
      /getWhatShouldWeCook/,
    )
  },
)

test(
  'M07 frontend service keeps Admin Recipe APIs separate from public Recipe APIs',
  () => {
    const source =
      readFrontend(
        'features/recipes/services/recipe.service.js',
      )

    assert.match(
      source,
      /\/admin\/recipes/,
    )

    assert.match(
      source,
      /\/recipes/,
    )
  },
)

test(
  'M07 frontend Recipe mutations obtain CSRF token',
  () => {
    const source =
      readFrontend(
        'features/recipes/services/recipe.service.js',
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
  'M07 P11 Recipe Browse uses live public Recipe API and links to detail',
  () => {
    const source =
      readFrontend(
        'features/recipes/pages/RecipesPage.jsx',
      )

    assert.match(
      source,
      /listPublicRecipes/,
    )

    assert.match(
      source,
      /\/recipes\//,
    )

    assert.doesNotMatch(
      stripComments(
        source,
      ),
      /ModulePlaceholderPage/,
    )
  },
)

test(
  'M07 P12 Recipe Detail uses deterministic serving scaling',
  () => {
    const source =
      readFrontend(
        'features/recipes/pages/RecipeDetailPage.jsx',
      )

    assert.match(
      source,
      /scalePublicRecipe/,
    )

    assert.match(
      source,
      /servings/,
    )

    assert.match(
      source,
      /Ingredients/,
    )

    assert.match(
      source,
      /Cooking steps/,
    )
  },
)

test(
  'M07 Recipe Detail keeps retail Pack commerce separate from requirement truth',
  () => {
    const source =
      stripComments(
        readFrontend(
          'features/recipes/pages/RecipeDetailPage.jsx',
        ),
      )

    assert.doesNotMatch(
      source,
      /HostOffer/,
    )

    assert.doesNotMatch(
      source,
      /InventorySnapshot/,
    )

    assert.doesNotMatch(
      source,
      /PriceRule/,
    )
  },
)

test(
  'M07 public Recipe history has a dedicated read-only UI',
  () => {
    const source =
      readFrontend(
        'features/recipes/pages/RecipeHistoryPage.jsx',
      )

    assert.match(
      source,
      /getPublicRecipeHistory/,
    )

    assert.match(
      source,
      /published/,
    )

    assert.match(
      source,
      /retired/,
    )
  },
)

test(
  'M07 P13 What Should We Cook shows deterministic coverage and missing counts',
  () => {
    const source =
      readFrontend(
        'features/recipes/pages/WhatShouldWeCookPage.jsx',
      )

    assert.match(
      source,
      /getWhatShouldWeCook/,
    )

    assert.match(
      source,
      /coverageRatio/,
    )

    assert.match(
      source,
      /missingIngredientCount/,
    )
  },
)

test(
  'M07 A09 Recipe Management supports governed Recipe draft creation',
  () => {
    const source =
      readFrontend(
        'features/admin/pages/AdminRecipesPage.jsx',
      )

    assert.match(
      source,
      /createAdminRecipe/,
    )

    assert.match(
      source,
      /canonicalIngredientId/,
    )

    assert.match(
      source,
      /Recipe v1/,
    )
  },
)

test(
  'M07 A09 Recipe creation contains no seller price or inventory state',
  () => {
    const source =
      stripComments(
        readFrontend(
          'features/admin/pages/AdminRecipesPage.jsx',
        ),
      )

    assert.doesNotMatch(
      source,
      /HostOffer/,
    )

    assert.doesNotMatch(
      source,
      /PriceRule/,
    )

    assert.doesNotMatch(
      source,
      /InventorySnapshot/,
    )
  },
)

test(
  'M07 A10 Recipe Editor exposes draft review publish and next-version workflow',
  () => {
    const source =
      readFrontend(
        'features/admin/pages/AdminRecipeEditorPage.jsx',
      )

    assert.match(
      source,
      /updateAdminRecipeDraft/,
    )

    assert.match(
      source,
      /submitAdminRecipeForReview/,
    )

    assert.match(
      source,
      /reviewAdminRecipeVersion/,
    )

    assert.match(
      source,
      /publishAdminRecipeVersion/,
    )

    assert.match(
      source,
      /createNextAdminRecipeVersion/,
    )
  },
)

test(
  'M07 A10 Recipe Editor shows source attribution and unsafe incomplete state',
  () => {
    const source =
      readFrontend(
        'features/admin/pages/AdminRecipeEditorPage.jsx',
      )

    assert.match(
      source,
      /Source type/,
    )

    assert.match(
      source,
      /unsafeIncomplete/,
    )

    assert.match(
      source,
      /sourceBrandId/,
    )
  },
)

test(
  'M07 frontend exposes P11 P12 P13 and Recipe history route tree',
  () => {
    const source =
      readFrontend(
        'routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /path="\/recipes"/,
    )

    assert.match(
      source,
      /\/recipes\/what-should-we-cook/,
    )

    assert.match(
      source,
      /\/recipes\/:slug\/history/,
    )

    assert.match(
      source,
      /\/recipes\/:slug/,
    )
  },
)

test(
  'M07 Admin Recipe frontend routes require existing recipe.read permission',
  () => {
    const source =
      readFrontend(
        'routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /\/admin\/recipes/,
    )

    assert.match(
      source,
      /permission="recipe\.read"/,
    )
  },
)

test(
  'M07 Admin Shell exposes Recipe Management only through recipe.read',
  () => {
    const source =
      readFrontend(
        'features/admin/components/AdminShell.jsx',
      )

    assert.match(
      source,
      /Recipe Management/,
    )

    assert.match(
      source,
      /recipe\.read/,
    )
  },
)

test(
  'M07 frontend does not create Recipe as Host application authority or new active mode',
  () => {
    const sources =
      [
        'features/recipes/services/recipe.service.js',
        'features/recipes/pages/RecipesPage.jsx',
        'features/recipes/pages/RecipeDetailPage.jsx',
        'features/recipes/pages/WhatShouldWeCookPage.jsx',
        'features/admin/pages/AdminRecipesPage.jsx',
        'features/admin/pages/AdminRecipeEditorPage.jsx',
      ]
        .map(
          readFrontend,
        )
        .map(
          stripComments,
        )
        .join(
          '\n',
        )

    assert.doesNotMatch(
      sources,
      /hostEnabled\s*=/,
    )

    assert.doesNotMatch(
      sources,
      /activeMode\s*=/,
    )

    assert.doesNotMatch(
      sources,
      /sellerEnabled\s*=/,
    )

    assert.doesNotMatch(
      sources,
      /brandEnabled\s*=/,
    )

    assert.doesNotMatch(
      sources,
      /b2bEnabled\s*=/,
    )
  },
)