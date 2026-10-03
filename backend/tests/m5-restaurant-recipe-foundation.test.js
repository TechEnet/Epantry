import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(here, '..')
const projectRoot = path.resolve(backendRoot, '..')

function readBackend(relativePath) {
  return fs.readFileSync(path.join(backendRoot, relativePath), 'utf8')
}

function readFrontend(relativePath) {
  return fs.readFileSync(path.join(projectRoot, 'frontend', relativePath), 'utf8')
}

test('M5-A extends the shared RecipeVersion foundation with restaurant outlet context and visibility without replacing the core recipe model', () => {
  const models = readBackend('src/modules/recipes/recipe.models.js')
  const validation = readBackend('src/modules/recipes/recipe.admin.validation.js')
  const service = readBackend('src/modules/recipes/recipe.admin.service.js')

  assert.match(models, /sourceOutletId:[\s\S]*?ref:[\s\S]*?'HospitalityOutlet'/)
  assert.match(models, /visibility:[\s\S]*?'public'[\s\S]*?'organization_only'[\s\S]*?default:[\s\S]*?'public'/)
  assert.match(validation, /outletId:[\s\S]*?objectIdSchema[\s\S]*?default\([\s\S]*?null/)
  assert.match(validation, /value\.type ===[\s\S]*?'chef'[\s\S]*?!value\.organizationId/)
  assert.match(validation, /visibility:[\s\S]*?'public'[\s\S]*?'organization_only'/)
  assert.match(service, /sourceOutletId:[\s\S]*?input\.source\.outletId/)
  assert.match(service, /visibility:[\s\S]*?input\.visibility/)
  assert.match(service, /sourceOutletId:[\s\S]*?sourceVersion\.sourceOutletId/)
})

test('M5-A keeps Hospitality production recipes as operational overlays while recording whether they are legacy or core-recipe linked', () => {
  const models = readBackend('src/modules/hospitality/hospitality.models.js')
  const validation = readBackend('src/modules/hospitality/hospitality.validation.js')
  const service = readBackend('src/modules/hospitality/hospitality.service.js')

  assert.match(models, /recipeFoundationMode:[\s\S]*?'legacy_hospitality'[\s\S]*?'core_recipe_linked'[\s\S]*?default: 'legacy_hospitality'/)
  assert.match(models, /listingOutletId:[\s\S]*?ref: 'HospitalityOutlet'/)
  assert.match(models, /customerVisibility:[\s\S]*?'organization_only'[\s\S]*?'public_candidate'/)
  assert.match(validation, /listingOutletId:[\s\S]*?objectIdSchema/)
  assert.match(validation, /customerVisibility:[\s\S]*?'organization_only'[\s\S]*?'public_candidate'/)
  assert.match(service, /HOSPITALITY_RECIPE_LISTING_OUTLET_NOT_FOUND/)
  assert.match(service, /recipeFoundationMode:[\s\S]*?input\.sourceRecipeVersionId[\s\S]*?'core_recipe_linked'[\s\S]*?'legacy_hospitality'/)
  assert.match(service, /customerVisibility:[\s\S]*?input\.customerVisibility/)
})

test('M5-A adds a read-only Super Admin migration audit that protects old Hospitality references instead of deleting or rewriting them', () => {
  const hospitalityService = readBackend('src/modules/hospitality/hospitality.service.js')
  const adminRoutes = readBackend('src/modules/hostOperations/hostOperations.routes.js')
  const adminPage = readFrontend('src/features/hostOperations/pages/AdminHostOperationsPage.jsx')

  assert.match(hospitalityService, /buildHospitalityRecipeMigrationAudit/)
  assert.match(hospitalityService, /legacy_unlinked/)
  assert.match(hospitalityService, /legacy_internal_bridge/)
  assert.match(hospitalityService, /broken_link/)
  assert.match(hospitalityService, /HospitalityMenuItem\.aggregate/)
  assert.match(hospitalityService, /HospitalityProductionPlan\.aggregate/)
  assert.match(hospitalityService, /HospitalityRecipeCost\.aggregate/)
  assert.match(hospitalityService, /DishPassportSnapshot\.aggregate/)
  assert.match(hospitalityService, /M5 keeps every existing Hospitality Production Recipe readable/)
  assert.doesNotMatch(hospitalityService, /deleteMany\(\{\}\)/)

  assert.match(adminRoutes, /recipeMigrationAudit:[\s\S]*?productionRecipes\.migrationAudit/)
  assert.match(adminPage, /Restaurant recipe migration safety/)
  assert.match(adminPage, /Read-only audit/)
  assert.match(adminPage, /M5-A does not delete or rewrite Menu, Production Plan, Costing or Dish Record references/)
})

test('M5-A leaves the existing Brand Recipe intake path on the core Recipe engine', () => {
  const hostOperations = readBackend('src/modules/hostOperations/hostOperations.service.js')

  assert.match(hostOperations, /createBrandRecipeSubmission/)
  assert.match(hostOperations, /source:[\s\S]*?type:[\s\S]*?'brand'/)
  assert.match(hostOperations, /await createAdminRecipe\(/)
})
