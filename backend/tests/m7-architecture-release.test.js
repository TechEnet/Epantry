import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(here, '..')
const projectRoot = path.resolve(backendRoot, '..')

function read(relativePath) {
  return fs.readFileSync(
    path.join(projectRoot, relativePath),
    'utf8',
  )
}

function segment(source, startToken, endToken) {
  const start = source.indexOf(startToken)
  const end = source.indexOf(endToken, start + startToken.length)

  assert.ok(start >= 0, `${startToken} must remain present.`)
  assert.ok(end > start, `${endToken} must follow ${startToken}.`)

  return source.slice(start, end)
}

test('M7-C preserves existing Brand Recipe Listings while Customer /recipes exposes Restaurant Recipes separately', () => {
  const recipesPage = read(
    'frontend/src/features/recipes/pages/RecipesPage.jsx',
  )
  const hostRoutes = read(
    'backend/src/modules/hostOperations/hostOperations.routes.js',
  )
  const hostService = read(
    'backend/src/modules/hostOperations/hostOperations.service.js',
  )

  assert.match(recipesPage, /sourceScope:\s*'standard'/)
  assert.match(recipesPage, /sourceScope:\s*'restaurant'/)
  assert.match(recipesPage, /From Restaurants/)

  assert.match(hostRoutes, /['"]\/brand-recipes['"]/)
  assert.match(hostService, /createBrandRecipeSubmission/)
})

test('M7-C keeps Restaurant Recipe servings, prepared-dish pricing and order foundation on the existing Commerce domain', () => {
  const recipeDetail = read(
    'frontend/src/features/recipes/pages/RecipeDetailPage.jsx',
  )
  const recipePublic = read(
    'backend/src/modules/recipes/recipe.public.service.js',
  )
  const checkout = read(
    'backend/src/modules/commerce/commerce.checkout.service.js',
  )

  assert.match(recipeDetail, /Order prepared dish/)
  assert.match(recipeDetail, /Increase Restaurant order servings/)
  assert.match(recipeDetail, /Decrease Restaurant order servings/)
  assert.match(recipeDetail, /restaurantOrder\.totalPrice/)

  assert.match(recipePublic, /restaurantOrder:/)
  assert.match(recipePublic, /pricePerServing/)
  assert.match(recipePublic, /totalPrice/)

  assert.match(checkout, /['"]restaurant_recipe['"]/)
  assert.match(checkout, /restaurantOrder:/)
  assert.match(
    checkout,
    /does not create a second payment engine/i,
  )
})

test('M7-C customer Restaurant Recipe payload does not expose supplier cost, margin or procurement data', () => {
  const recipePublic = read(
    'backend/src/modules/recipes/recipe.public.service.js',
  )

  const restaurantContext = segment(
    recipePublic,
    'contextMap.set(',
    'return contextMap',
  )

  assert.match(restaurantContext, /restaurantName:/)
  assert.match(restaurantContext, /outletName:/)
  assert.match(restaurantContext, /pricePerServing/)

  assert.doesNotMatch(restaurantContext, /supplierCost/i)
  assert.doesNotMatch(restaurantContext, /costPerPortion/i)
  assert.doesNotMatch(restaurantContext, /procurement/i)
  assert.doesNotMatch(restaurantContext, /margin/i)
})

test('M7-C preserves Customer personal recipes as Private/Friends only and keeps Chef + Restaurant Host capability boundaries', () => {
  const community = read(
    'backend/src/modules/community/community.service.js',
  )
  const hostWorkspace = read(
    'frontend/src/features/host/hostWorkspace.config.js',
  )

  assert.match(
    community,
    /Personal Community recipes can only be Private or Friends only\./,
  )
  assert.match(
    community,
    /COMMUNITY_PUBLIC_PUBLISHING_DISABLED/,
  )

  assert.match(
    hostWorkspace,
    /CHEF_RESTAURANT:\s*'chef_restaurant'/,
  )
  assert.match(
    hostWorkspace,
    /const CHEF_RESTAURANT_PATHS[\s\S]*?'\/host\/hospitality'[\s\S]*?'\/host\/creator-studio'/,
  )
  assert.match(
    hostWorkspace,
    /const BRAND_HOST_PATHS[\s\S]*?'\/host\/brand-recipes'/,
  )
})

test('M7-C preserves requested Host type visibility, centralized Hospitality governance audit and approval deep links', () => {
  const hostReview = read(
    'frontend/src/features/admin/pages/AdminHostReviewPage.jsx',
  )
  const notificationService = read(
    'backend/src/modules/notifications/notification.service.js',
  )
  const adminAuditRegistry = read(
    'backend/src/modules/admin/adminAudit.registry.js',
  )
  const adminRoutes = read(
    'backend/src/modules/hostOperations/hostOperations.routes.js',
  )

  assert.match(hostReview, /Requested Host workspace/)
  assert.match(hostReview, /hostWorkspaceTypeLabel/)

  assert.match(
    notificationService,
    /\/admin\/host-operations\?tab=hospitality&focus=/,
  )
  assert.match(
    notificationService,
    /restaurant_recipe_listing:[\s\S]*?'restaurant_recipe'/,
  )
  assert.match(
    notificationService,
    /hospitality_dish_passport:[\s\S]*?'dish_passport'/,
  )
  assert.match(
    notificationService,
    /hospitality_change_case:[\s\S]*?'change_case'/,
  )

  assert.match(adminAuditRegistry, /['"]hospitality\.governance['"]/)
  assert.match(adminRoutes, /hospitality\.restaurant_recipe\.approve/)
  assert.match(adminRoutes, /hospitality\.production_recipe\.approve/)
  assert.match(adminRoutes, /hospitality\.dish_passport\.approve/)
  assert.match(adminRoutes, /hospitality\.change_case\.approve/)
})

test('M7-C keeps existing Razorpay checkout/webhook infrastructure and does not introduce a Restaurant payment engine', () => {
  const paymentProvider = read(
    'backend/src/modules/commerce/commerce.payment.provider.js',
  )
  const finalCommerce = read(
    'backend/src/modules/commerce/commerce.final.service.js',
  )
  const app = read('backend/src/app.js')
  const restaurantCheckout = read(
    'backend/src/modules/commerce/commerce.checkout.service.js',
  )

  assert.match(paymentProvider, /createRazorpayOrder/)
  assert.match(paymentProvider, /verifyRazorpayCheckoutSignature/)
  assert.match(paymentProvider, /verifyRazorpayWebhookSignature/)
  assert.match(finalCommerce, /createRazorpayOrder/)
  assert.match(finalCommerce, /processRazorpayWebhook/)

  const webhookIndex = app.indexOf("'/api/v1/webhooks'")
  const jsonIndex = app.indexOf('express.json')

  assert.ok(webhookIndex >= 0)
  assert.ok(jsonIndex > webhookIndex)

  assert.match(
    restaurantCheckout,
    /does not create a second payment engine/i,
  )
})

test('M7-C final Hospitality release gate is additive, read-only and blocks duplicate-authoring retirement until parity plus regression are verified', () => {
  const hospitality = read(
    'backend/src/modules/hospitality/hospitality.service.js',
  )
  const hospitalityModels = read(
    'backend/src/modules/hospitality/hospitality.models.js',
  )
  const adminPage = read(
    'frontend/src/features/hostOperations/pages/AdminHostOperationsPage.jsx',
  )

  assert.match(hospitality, /buildHospitalityRecipeMigrationAudit/)
  assert.match(hospitality, /buildM7HospitalityReleaseGate/)
  assert.match(hospitality, /mode:\s*'dry_run'/)
  assert.match(hospitality, /writesPerformed:\s*false/)
  assert.match(hospitality, /deletedRecords:\s*0/)
  assert.match(hospitality, /rewrittenHistoricalRecords:\s*0/)
  assert.match(hospitality, /keepLegacyPathVisible:\s*true/)
  assert.match(hospitality, /awaiting_final_regression/)
  assert.match(hospitality, /blocked_by_data_parity/)
  assert.match(
    hospitality,
    /node --test tests\/m7-architecture-release\.test\.js/,
  )

  assert.match(hospitalityModels, /HospitalityProductionRecipeVersion/)
  assert.match(hospitalityModels, /productionRecipeVersionId/)
  assert.match(hospitalityModels, /sourceRecipeVersionId/)

  assert.match(adminPage, /M7 final release gate/)
  assert.match(adminPage, /Awaiting regression/)
  assert.match(adminPage, /legacy Hospitality authoring must remain visible/i)
})

test('M7-C migration scripts remain non-destructive', () => {
  const scriptsDir = path.join(backendRoot, 'scripts')
  const migrations = fs
    .readdirSync(scriptsDir)
    .filter(
      (name) => name.startsWith('migrate-') && name.endsWith('.mjs'),
    )

  assert.ok(migrations.length > 0)

  for (const name of migrations) {
    const source = fs.readFileSync(
      path.join(scriptsDir, name),
      'utf8',
    )

    assert.doesNotMatch(source, /\.dropDatabase\s*\(/)
    assert.doesNotMatch(source, /\.dropCollection\s*\(/)
    assert.doesNotMatch(source, /\.deleteMany\s*\(\s*\{\s*\}\s*\)/)
  }
})
