import assert from 'node:assert/strict'

import fs from 'node:fs'

import test from 'node:test'

import {
  M07_RECIPE_SEED_BLUEPRINTS,
} from '../src/modules/recipes/recipe.seed.js'

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
  'M07 app mounts public Recipe API separately',
  () => {
    const source =
      readSource(
        'app.js',
      )

    assert.match(
      source,
      /['"]\/api\/v1\/recipes['"]/,
    )

    assert.match(
      source,
      /recipePublicRoutes/,
    )
  },
)

test(
  'M07 app mounts privileged Recipe governance under existing Admin surface',
  () => {
    const source =
      readSource(
        'app.js',
      )

    assert.match(
      source,
      /recipeAdminRoutes/,
    )

    assert.match(
      source,
      /['"]\/api\/v1\/admin['"]/,
    )
  },
)

test(
  'M07 Recipe Admin rejects privileged impersonation',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /rejectPrivilegedImpersonation/,
    )
  },
)

test(
  'M07 Recipe Admin requires session and active account',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /authenticateSession/,
    )

    assert.match(
      source,
      /loadCurrentUser/,
    )

    assert.match(
      source,
      /requireActiveAccount/,
    )
  },
)

test(
  'M07 entire Recipe Admin surface requires MFA assurance',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /requireMfaAssurance/,
    )
  },
)

test(
  'M07 Recipe Admin reads require existing recipe.read permission',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /recipe\.read/,
    )

    assert.match(
      source,
      /requireRecipeRead/,
    )
  },
)

test(
  'M07 Recipe mutations require recipe.mutate CSRF and recent MFA',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /recipe\.mutate/,
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
  'M07 Recipe publication requires existing recipe.publish permission',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /recipe\.publish/,
    )

    assert.match(
      source,
      /requireRecipePublish/,
    )
  },
)

test(
  'M07 Recipe Admin exposes create list detail update and next-version APIs',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /router\.post\(\s*['"]\/recipes['"]/s,
    )

    assert.match(
      source,
      /router\.get\(\s*['"]\/recipes['"]/s,
    )

    assert.match(
      source,
      /recipes\/versions\/:versionId/,
    )

    assert.match(
      source,
      /router\.patch/,
    )

    assert.match(
      source,
      /recipes\/:dishId\/versions/,
    )
  },
)

test(
  'M07 Recipe Admin exposes review publish and lifecycle governance APIs',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.routes.js',
      )

    assert.match(
      source,
      /submit-review/,
    )

    assert.match(
      source,
      /:versionId\/review/,
    )

    assert.match(
      source,
      /:versionId\/publish/,
    )

    assert.match(
      source,
      /:versionId\/lifecycle/,
    )

    assert.match(
      source,
      /:dishId\/lifecycle/,
    )
  },
)

test(
  'M07 does not create a Host Recipe tenant router or Super Admin Host bypass',
  () => {
    const source =
      stripComments(
        readSource(
          'app.js',
        ),
      )

    assert.doesNotMatch(
      source,
      /host\/recipes/,
    )
  },
)

test(
  'M07 Recipe draft mutations use immutable M03 admin audit service',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.controller.js',
      )

    assert.match(
      source,
      /recordAdminAuditEvent/,
    )

    assert.match(
      source,
      /recipe\.mutate/,
    )

    assert.match(
      source,
      /recipe\.governance/,
    )
  },
)

test(
  'M07 governance receives resolved admin authorization and request ID',
  () => {
    const source =
      readSource(
        'modules/recipes/recipe.admin.controller.js',
      )

    assert.match(
      source,
      /adminAuthorization:\s*req\.adminAuthorization/,
    )

    assert.match(
      source,
      /requestId:\s*req\.requestId/,
    )
  },
)

test(
  'M07 curated development seed contains at least thirty Recipe blueprints',
  () => {
    assert.ok(
      M07_RECIPE_SEED_BLUEPRINTS.length >=
        30,
    )
  },
)

test(
  'M07 Recipe seed creates governed drafts through Recipe service instead of direct publication',
  () => {
    const source =
      stripComments(
        readSource(
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

    assert.doesNotMatch(
      source,
      /publishedAt\s*:/,
    )
  },
)

test(
  'M07 API wiring introduces no Brand Seller B2B role or commercial Recipe state',
  () => {
    const sources =
      [
        'modules/recipes/recipe.admin.routes.js',
        'modules/recipes/recipe.admin.controller.js',
        'modules/recipes/recipe.public.routes.js',
        'modules/recipes/recipe.public.service.js',
      ]
        .map(
          readSource,
        )
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
      /activeMode\s*=/,
    )

    assert.doesNotMatch(
      sources,
      /HostOffer/,
    )

    assert.doesNotMatch(
      sources,
      /PriceRule/,
    )

    assert.doesNotMatch(
      sources,
      /InventorySnapshot/,
    )
  },
)