import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  M07_RECIPE_SEED_BLUEPRINTS,
} from '../src/modules/recipes/recipe.seed.js'

import {
  Dish,
  RecipeIngredient,
  RecipeReview,
  RecipeStep,
  RecipeSubstitution,
  RecipeVersion,
} from '../src/modules/recipes/recipe.models.js'

function readBackend(
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
  'M07 freeze keeps Dish RecipeVersion Ingredient Step Substitution and Review as dedicated Recipe domain collections',
  () => {
    assert.equal(
      Dish.collection.name,
      'dishes',
    )

    assert.equal(
      RecipeVersion.collection.name,
      'recipeVersions',
    )

    assert.equal(
      RecipeIngredient.collection.name,
      'recipeIngredients',
    )

    assert.equal(
      RecipeStep.collection.name,
      'recipeSteps',
    )

    assert.equal(
      RecipeSubstitution.collection.name,
      'recipeSubstitutions',
    )

    assert.equal(
      RecipeReview.collection.name,
      'recipeReviews',
    )
  },
)

test(
  'M07 freeze keeps Recipe requirements linked to canonical Ingredient identity',
  () => {
    assert.ok(
      RecipeIngredient
        .schema
        .paths
        .canonicalIngredientId,
    )
  },
)

test(
  'M07 freeze keeps public Recipe surface read only',
  () => {
    const source =
      stripComments(
        readBackend(
          'modules/recipes/recipe.public.routes.js',
        ),
      )

    assert.match(
      source,
      /router\.get/,
    )

    assert.doesNotMatch(
      source,
      /router\.post/,
    )

    assert.doesNotMatch(
      source,
      /router\.patch/,
    )

    assert.doesNotMatch(
      source,
      /router\.delete/,
    )
  },
)

test(
  'M07 freeze exposes only current governed published Recipe Version to public detail and scaling',
  () => {
    const source =
      readBackend(
        'modules/recipes/recipe.public.service.js',
      )

    assert.match(
      source,
      /status:\s*'published'/,
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
  'M07 freeze keeps Recipe scaling deterministic and separate from retail Pack conversion',
  () => {
    const source =
      stripComments(
        readBackend(
          'modules/recipes/recipe.scaling.js',
        ),
      )

    assert.match(
      source,
      /calculateRecipeScalingMultiplier/,
    )

    assert.match(
      source,
      /convertRecipeQuantity/,
    )

    assert.doesNotMatch(
      source,
      /HostOffer/,
    )

    assert.doesNotMatch(
      source,
      /PriceRule/,
    )
  },
)

test(
  'M07 freeze keeps Marketplace price stock and serviceability outside Recipe domain',
  () => {
    const sources =
      [
        'modules/recipes/recipe.models.js',
        'modules/recipes/recipe.public.service.js',
        'modules/recipes/recipe.admin.service.js',
        'modules/recipes/recipe.governance.service.js',
      ]
        .map(
          readBackend,
        )
        .map(
          stripComments,
        )
        .join(
          '\n',
        )

    assert.doesNotMatch(
      sources,
      /HostOffer/,
    )

    assert.doesNotMatch(
      sources,
      /InventorySnapshot/,
    )

    assert.doesNotMatch(
      sources,
      /PriceRule/,
    )

    assert.doesNotMatch(
      sources,
      /ServiceArea/,
    )
  },
)

test(
  'M07 freeze protects entire Recipe Admin surface with admin authorization and MFA',
  () => {
    const source =
      readBackend(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /loadAdminAuthorization/,
    )

    assert.match(
      source,
      /requireAdminAccess/,
    )

    assert.match(
      source,
      /requireMfaAssurance/,
    )

    assert.match(
      source,
      /rejectPrivilegedImpersonation/,
    )
  },
)

test(
  'M07 freeze protects Recipe mutations with CSRF and recent MFA',
  () => {
    const source =
      readBackend(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /requireCsrfToken/,
    )

    assert.match(
      source,
      /requireRecentMfaAuthentication/,
    )
  },
)

test(
  'M07 freeze keeps Recipe read mutate and publish on existing M03 permissions',
  () => {
    const source =
      readBackend(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /recipe\.read/,
    )

    assert.match(
      source,
      /recipe\.mutate/,
    )

    assert.match(
      source,
      /recipe\.publish/,
    )
  },
)

test(
  'M07 freeze enforces distinct submitter and publisher for Recipe publication',
  () => {
    const source =
      readBackend(
        'modules/recipes/recipe.governance.service.js',
      )

    assert.match(
      source,
      /assertDistinctMakerCheckerActors/,
    )

    assert.match(
      source,
      /submittedByUserId/,
    )

    assert.match(
      source,
      /publisherUserId/,
    )
  },
)

test(
  'M07 freeze records Recipe governance in immutable Admin audit service',
  () => {
    const sources =
      [
        'modules/recipes/recipe.governance.service.js',
        'modules/recipes/recipe.admin.controller.js',
      ]
        .map(
          readBackend,
        )
        .join(
          '\n',
        )

    assert.match(
      sources,
      /recordAdminAuditEvent/,
    )

    assert.match(
      sources,
      /recipe\.governance/,
    )
  },
)

test(
  'M07 freeze keeps published history immutable and creates next Recipe Version for corrections',
  () => {
    const sources =
      [
        'modules/recipes/recipe.admin.service.js',
        'modules/recipes/recipe.governance.service.js',
      ]
        .map(
          readBackend,
        )
        .join(
          '\n',
        )

    assert.match(
      sources,
      /Only draft Recipe Versions may be edited/,
    )

    assert.match(
      sources,
      /createNextAdminRecipeVersion/,
    )

    assert.doesNotMatch(
      sources,
      /RecipeVersion\.deleteOne/,
    )

    assert.doesNotMatch(
      sources,
      /RecipeVersion\.deleteMany/,
    )
  },
)

test(
  'M07 freeze keeps launch seed at thirty or more governed draft Recipe blueprints',
  () => {
    assert.ok(
      M07_RECIPE_SEED_BLUEPRINTS.length >=
        30,
    )

    const source =
      stripComments(
        readBackend(
          'modules/recipes/recipe.seed.js',
        ),
      )

    assert.match(
      source,
      /createAdminRecipe/,
    )

    assert.doesNotMatch(
      source,
      /status\s*:\s*['"]published['"]/,
    )
  },
)

test(
  'M07 freeze does not create Host Recipe tenant authority or Super Admin Host bypass',
  () => {
    const source =
      stripComments(
        readBackend(
          'app.js',
        ),
      )

    assert.doesNotMatch(
      source,
      /\/host\/recipes/,
    )

    assert.match(
      source,
      /\/api\/v1\/admin/,
    )

    assert.match(
      source,
      /\/api\/v1\/recipes/,
    )
  },
)

test(
  'M07 freeze exposes public and Admin Recipe frontend route trees separately',
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
      /path="\/admin\/recipes"/,
    )

    assert.match(
      source,
      /permission="recipe\.read"/,
    )
  },
)

test(
  'M07 freeze preserves Customer Host Super Admin as the only application access architecture',
  () => {
    const sources =
      [
        readBackend(
          'modules/recipes/recipe.models.js',
        ),

        readBackend(
          'modules/recipes/recipe.admin.routes.js',
        ),

        readBackend(
          'modules/recipes/recipe.public.routes.js',
        ),

        readFrontend(
          'routes/AppRoutes.jsx',
        ),
      ]
        .map(
          stripComments,
        )
        .join(
          '\n',
        )

    assert.doesNotMatch(
      sources,
      /brandEnabled\s*=/,
    )

    assert.doesNotMatch(
      sources,
      /sellerEnabled\s*=/,
    )

    assert.doesNotMatch(
      sources,
      /b2bEnabled\s*=/,
    )

    assert.doesNotMatch(
      sources,
      /activeMode\s*=\s*['"]recipe/,
    )
  },
)