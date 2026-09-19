import assert from 'node:assert/strict'

import {
  readFile,
} from 'node:fs/promises'

import {
  test,
} from 'node:test'

import request from 'supertest'

import app from '../src/app.js'

const projectRoot =
  new URL(
    '..',
    import.meta.url,
  )

async function readProjectFile(
  path,
) {
  return readFile(
    new URL(
      path,
      projectRoot,
    ),
    'utf8',
  )
}

/*
|--------------------------------------------------------------------------
| App Mounts
|--------------------------------------------------------------------------
*/

test(
  'M09 application mounts Household Pantry under API v1',

  async () => {
    const source =
      await readProjectFile(
        'src/app.js',
      )

    assert.match(
      source,
      /import pantryRoutes from '\.\/modules\/pantry\/pantry\.routes\.js'/,
    )

    assert.match(
      source,
      /app\.use\(\s*'\/api\/v1\/pantry',\s*sensitiveResponseNoStoreMiddleware,\s*pantryRoutes,\s*\)/s,
    )
  },
)

test(
  'M09 application mounts protected Recipe Pantry actions under existing Recipe prefix',

  async () => {
    const source =
      await readProjectFile(
        'src/app.js',
      )

    assert.match(
      source,
      /import pantryRecipeRoutes from '\.\/modules\/pantry\/pantry\.recipe\.routes\.js'/,
    )

    assert.match(
      source,
      /app\.use\(\s*'\/api\/v1\/recipes',\s*pantryRecipeRoutes,\s*\)/s,
    )
  },
)

/*
|--------------------------------------------------------------------------
| M07 Preservation
|--------------------------------------------------------------------------
*/

test(
  'M09 application preserves existing public M07 Recipe router',

  async () => {
    const source =
      await readProjectFile(
        'src/app.js',
      )

    assert.match(
      source,
      /import recipePublicRoutes from '\.\/modules\/recipes\/recipe\.public\.routes\.js'/,
    )

    assert.match(
      source,
      /app\.use\(\s*'\/api\/v1\/recipes',\s*recipePublicRoutes,\s*\)/s,
    )
  },
)

test(
  'M09 protected Recipe router is mounted before public Recipe router without replacing it',

  async () => {
    const source =
      await readProjectFile(
        'src/app.js',
      )

    const pantryMount =
      /app\.use\(\s*'\/api\/v1\/recipes',\s*pantryRecipeRoutes,\s*\)/s.exec(
        source,
      )

    const publicMount =
      /app\.use\(\s*'\/api\/v1\/recipes',\s*recipePublicRoutes,\s*\)/s.exec(
        source,
      )

    assert.ok(
      pantryMount,
    )

    assert.ok(
      publicMount,
    )

    assert.ok(
      pantryMount.index <
      publicMount.index,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Route-scoped Authentication
|--------------------------------------------------------------------------
*/

test(
  'M09 Recipe Pantry authentication is scoped only to Pantry and Cooked paths',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.routes.js',
      )

    assert.match(
      source,
      /router\.use\(\s*'\/:id\/pantry',[\s\S]*?authenticateSession,[\s\S]*?loadCurrentUser,[\s\S]*?requireActiveAccount,[\s\S]*?requireCustomerAccess,/,
    )

    assert.match(
      source,
      /router\.use\(\s*'\/:id\/cooked',[\s\S]*?authenticateSession,[\s\S]*?loadCurrentUser,[\s\S]*?requireActiveAccount,[\s\S]*?requireCustomerAccess,/,
    )

    assert.doesNotMatch(
      source,
      /router\.use\(\s*authenticateSession/,
    )
  },
)

test(
  'M09 Recipe Pantry responses use no-store without changing entire public Recipe prefix',

  async () => {
    const routeSource =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.routes.js',
      )

    const appSource =
      await readProjectFile(
        'src/app.js',
      )

    assert.match(
      routeSource,
      /sensitiveResponseNoStoreMiddleware/,
    )

    assert.doesNotMatch(
      appSource,
      /app\.use\(\s*'\/api\/v1\/recipes',\s*sensitiveResponseNoStoreMiddleware,\s*pantryRecipeRoutes/s,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Security Boundary
|--------------------------------------------------------------------------
*/

test(
  'M09 Recipe Pantry uses Customer capability without Host or Super Admin authority gate',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.routes.js',
      )

    assert.match(
      source,
      /requireCustomerAccess/,
    )

    assert.doesNotMatch(
      source,
      /requireHostAccess/,
    )

    assert.doesNotMatch(
      source,
      /requireSuperAdminAccess/,
    )
  },
)

test(
  'M09 cooked Recipe mutation remains CSRF protected',

  async () => {
    const source =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.routes.js',
      )

    assert.match(
      source,
      /router\.post\(\s*'\/:id\/cooked',\s*requireCsrfToken,\s*recordRecipeCookedController,\s*\)/s,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Actual App-level Mount Proof
|--------------------------------------------------------------------------
*/

test(
  'M09 live Pantry mount rejects unauthenticated request',

  async () => {
    const response =
      await request(
        app,
      )
        .get(
          '/api/v1/pantry',
        )

    assert.equal(
      response.statusCode,
      401,
    )
  },
)

test(
  'M09 live Recipe Pantry mount rejects unauthenticated request',

  async () => {
    const response =
      await request(
        app,
      )
        .get(
          '/api/v1/recipes/example-recipe/pantry',
        )
        .query({
          targetServings:
            2,
        })

    assert.equal(
      response.statusCode,
      401,
    )
  },
)

test(
  'M09 live Recipe cooked mount rejects unauthenticated request before mutation',

  async () => {
    const response =
      await request(
        app,
      )
        .post(
          '/api/v1/recipes/example-recipe/cooked',
        )
        .set(
          'Idempotency-Key',
          'm09-freeze-test-event',
        )
        .send({
          targetServings:
            2,
        })

    assert.equal(
      response.statusCode,
      401,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Public Recipe Tree Must Not Be Globally Authenticated
|--------------------------------------------------------------------------
*/

test(
  'M09 Recipe Pantry router does not turn unrelated Recipe paths into authenticated routes',

  async () => {
    const response =
      await request(
        app,
      )
        .get(
          '/api/v1/recipes/__m09_unknown__/not-a-pantry-action',
        )

    assert.equal(
      response.statusCode,
      404,
    )

    assert.notEqual(
      response.statusCode,
      401,
    )
  },
)

/*
|--------------------------------------------------------------------------
| Cross-domain Freeze
|--------------------------------------------------------------------------
*/

test(
  'M09 app integration keeps Pantry separate from Marketplace and Food Intelligence authority',

  async () => {
    const pantrySource =
      await readProjectFile(
        'src/modules/pantry/pantry.recipe.service.js',
      )

    assert.doesNotMatch(
      pantrySource,
      /HostOffer|SellerOffer|PriceRule|InventorySnapshot|ServiceArea/,
    )

    assert.doesNotMatch(
      pantrySource,
      /FoodCalculation|Allergen|Nutrient/,
    )

    assert.doesNotMatch(
      pantrySource,
      /OutcomePlan|RequirementBasket/,
    )
  },
)

/*
|--------------------------------------------------------------------------
| App Compilation
|--------------------------------------------------------------------------
*/

test(
  'M09 application compiles with Pantry mounts',

  () => {
    assert.ok(
      app,
    )

    assert.equal(
      typeof app,
      'function',
    )
  },
)