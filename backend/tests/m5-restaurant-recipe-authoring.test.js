import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(here, '..')
const repoRoot = path.resolve(backendRoot, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

test('M5-B Restaurant Recipe uses core recipe lineage plus Hospitality overlay', () => {
  const source = read('backend/src/modules/hospitality/hospitality.service.js')

  assert.match(source, /source:\s*\{[\s\S]*type:\s*'chef'/)
  assert.match(source, /recipeFoundationMode:\s*'core_recipe_linked'/)
  assert.match(source, /sourceRecipeVersionId:/)
  assert.match(source, /customerVisibility/)
})

test('M5-B keeps legacy production recipe endpoints while adding Restaurant Recipe endpoints', () => {
  const routes = read('backend/src/modules/hospitality/hospitality.routes.js')

  assert.match(routes, /'\/restaurant-recipes'/)
  assert.match(routes, /'\/production-recipes'/)
  assert.match(routes, /requireHospitalityRecipeHostAccess/)
})

test('M5-B Super Admin review is wired through Host Operations', () => {
  const routes = read('backend/src/modules/hostOperations/hostOperations.routes.js')

  assert.match(routes, /hospitality\/restaurant-recipes\/:id\/review/)
  assert.match(routes, /listAdminHospitalityRestaurantRecipeApprovals/)
  assert.match(routes, /reviewHospitalityRestaurantRecipeAsSuperAdmin/)
})

test('Host standalone Kitchen Recipe URLs return to Unified Listing Studio', () => {
  const routes = read('frontend/src/routes/AppRoutes.jsx')

  assert.match(routes, /host\/hospitality\/recipes/)
  assert.match(routes, /host\/hospitality\/legacy-recipes/)
  assert.match(routes, /Navigate to="\/host\/listings\/new/)
})

test('M5-B Host authoring includes customer recipe truth and internal operational settings', () => {
  const page = read('frontend/src/features/hospitality/pages/RestaurantRecipesPage.jsx')

  assert.match(page, /Customer-facing recipe details/)
  assert.match(page, /Ingredients \+ kitchen settings/)
  assert.match(page, /Cooking steps/)
  assert.match(page, /Nutrition, allergens & dietary information/)
  assert.match(page, /expectedWastePercentage/)
  assert.match(page, /preferredSupplierProductId/)
})

test('Published restaurant recipe changes create a new review version without overwriting the approved record', () => {
  const service = read('backend/src/modules/hospitality/hospitality.service.js')
  const routes = read('backend/src/modules/hospitality/hospitality.routes.js')
  assert.match(service, /export async function reviseHospitalityRestaurantRecipe/)
  assert.match(service, /createNextAdminRecipeVersion\(source\.dishId/)
  assert.match(service, /sourceOrganizationId: context\.organization\._id/)
  assert.match(service, /HOSPITALITY_RECIPE_REVISION_PENDING/)
  assert.match(service, /version\.status = 'published'/)
  assert.match(service, /overlay\.pendingDishMetadata/)
  assert.match(routes, /'\/restaurant-recipes\/:id\/revisions'/)
  assert.match(routes, /requireRecentMfaAuthentication/)
})

test('Final product evidence corrections are submitted as separately reviewed drafts', () => {
  const service = read('backend/src/modules/universalProduct/universalProduct.npi.service.js')
  const routes = read('backend/src/modules/universalProduct/universalProduct.routes.js')
  const model = read('backend/src/modules/universalProduct/universalProduct.models.js')
  assert.match(service, /export async function reviseHostNpiDraft/)
  assert.match(service, /revisesDraftId: original\._id/)
  assert.match(service, /status: 'provisional'/)
  assert.match(service, /readyForCatalog: false/)
  assert.match(service, /HOST_NPI_REVISION_ALREADY_PENDING/)
  assert.match(model, /revisesDraftId:/)
  assert.match(routes, /'\/universal-product\/npi\/drafts\/:id\/revisions'/)
  assert.match(routes, /requireRecentMfaAuthentication/)
})
