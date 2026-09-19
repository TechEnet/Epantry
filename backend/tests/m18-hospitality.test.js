import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename =
  fileURLToPath(
    import.meta.url,
  )

const __dirname =
  path.dirname(
    __filename,
  )

const backendRoot =
  path.resolve(
    __dirname,
    '..',
  )

function read(
  relativePath,
) {
  return fs.readFileSync(
    path.join(
      backendRoot,
      relativePath,
    ),
    'utf8',
  )
}

test(
  'M18 Batch 1 registers Hospitality operational collections without creating a second B2B organization truth',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.models.js',
      )

    for (
      const collection of [
        'hospitalityProfiles',
        'hospitalityOutlets',
        'hospitalityMemberGrants',
        'hospitalitySuppliers',
        'hospitalitySupplierProducts',
        'hospitalityProductionRecipeVersions',
        'hospitalityProductionRecipeIngredients',
        'hospitalityMenus',
        'hospitalityMenuItems',
        'hospitalityRecipeCosts',
        'hospitalityStockObservations',
        'hospitalityProductionPlans',
        'hospitalityProcurementPlans',
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          `collection:\\s*['"]${collection}['"]`,
        ),
      )
    }

    assert.doesNotMatch(
      source,
      /collection:\s*['"]b2bOrganizations['"]/i,
    )

    assert.doesNotMatch(
      source,
      /collection:\s*['"]B2BOrganization['"]/,
    )
  },
)

test(
  'M18 Hospitality reuses MarketplaceOrganization as tenant',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      source,
      /MarketplaceOrganization/,
    )

    assert.match(
      source,
      /ensureHostMarketplaceOrganization/,
    )

    assert.match(
      source,
      /organizationId/,
    )
  },
)

test(
  'M18 member grants are explicit permission and outlet scope overlays',
  () => {
    const models =
      read(
        'src/modules/hospitality/hospitality.models.js',
      )

    const service =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      models,
      /HOSPITALITY_PERMISSION_KEYS/,
    )

    assert.match(
      models,
      /outletIds/,
    )

    assert.match(
      service,
      /assertOutletScope/,
    )

    assert.match(
      service,
      /HOSPITALITY_ORGANIZATION_SELECTION_REQUIRED/,
    )
  },
)

test(
  'M18 Supplier Product remains a commercial overlay linked to canonical Pack or Ingredient',
  () => {
    const models =
      read(
        'src/modules/hospitality/hospitality.models.js',
      )

    const service =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      models,
      /canonicalPackId/,
    )

    assert.match(
      models,
      /canonicalIngredientId/,
    )

    assert.match(
      models,
      /supplierSku/,
    )

    assert.match(
      models,
      /contractCost/,
    )

    assert.match(
      service,
      /requireCurrentPublishedPack/,
    )
  },
)

test(
  'M18 Supplier Product contract facts are versioned instead of price-overwritten',
  () => {
    const models =
      read(
        'src/modules/hospitality/hospitality.models.js',
      )

    const validation =
      read(
        'src/modules/hospitality/hospitality.validation.js',
      )

    const service =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      models,
      /supplierSku:[\s\S]*?versionNumber:/,
    )

    assert.match(
      service,
      /latestVersion[\s\S]*?versionNumber/,
    )

    assert.doesNotMatch(
      validation,
      /updateSupplierProductBodySchema[\s\S]{0,500}contractCost/,
    )
  },
)

test(
  'M18 Production Recipe is versioned and may reference governed M07 Dish and RecipeVersion',
  () => {
    const models =
      read(
        'src/modules/hospitality/hospitality.models.js',
      )

    const service =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      models,
      /recipeKey/,
    )

    assert.match(
      models,
      /versionNumber/,
    )

    assert.match(
      models,
      /sourceRecipeVersionId/,
    )

    assert.match(
      models,
      /dishId/,
    )

    assert.match(
      service,
      /RecipeVersion\.findOne/,
    )

    assert.match(
      service,
      /Dish\.findOne/,
    )
  },
)

test(
  'M18 Production Recipe approval uses Host maker-checker',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      source,
      /submittedByUserId/,
    )

    assert.match(
      source,
      /approvedByUserId/,
    )

    assert.match(
      source,
      /HOSPITALITY_PRODUCTION_RECIPE_MAKER_CHECKER_REQUIRED/,
    )
  },
)

test(
  'M18 recipe costing uses Supplier contract cost and integer minor units',
  () => {
    const models =
      read(
        'src/modules/hospitality/hospitality.models.js',
      )

    const service =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      models,
      /amountMinor/,
    )

    assert.match(
      models,
      /Number\.isInteger/,
    )

    assert.match(
      service,
      /contractCost\.amountMinor/,
    )

    assert.match(
      service,
      /costPerPortionMinor/,
    )
  },
)

test(
  'M18 production planning uses append-only stock observations and deterministic Recipe unit conversion',
  () => {
    const models =
      read(
        'src/modules/hospitality/hospitality.models.js',
      )

    const service =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    const routes =
      read(
        'src/modules/hospitality/hospitality.routes.js',
      )

    assert.match(
      models,
      /hospitalityStockObservations/,
    )

    assert.match(
      service,
      /convertRecipeQuantity/,
    )

    assert.match(
      service,
      /latestStockObservation/,
    )

    assert.match(
      routes,
      /['"]\/stock-observations['"]/,
    )

    assert.doesNotMatch(
      routes,
      /patch\([\s\S]{0,80}stock-observations/i,
    )
  },
)

test(
  'M18 Production Plan scales approved recipes and reconciles observed on-hand evidence',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      source,
      /requireApprovedProductionRecipe/,
    )

    assert.match(
      source,
      /baseYieldPortions/,
    )

    assert.match(
      source,
      /grossRequirements/,
    )

    assert.match(
      source,
      /stockReconciliation/,
    )

    assert.match(
      source,
      /netRequirements/,
    )
  },
)

test(
  'M18 Procurement Plan performs deterministic supplier comparison without automatic PO submission',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    const models =
      read(
        'src/modules/hospitality/hospitality.models.js',
      )

    assert.match(
      source,
      /lowest_known_contract_cost/,
    )

    assert.match(
      source,
      /automaticPurchaseOrderSubmission:\s*false/,
    )

    assert.match(
      source,
      /rfqAuctionImplemented:\s*false/,
    )

    assert.match(
      models,
      /automaticPurchaseOrderSubmission/,
    )
  },
)