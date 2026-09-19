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

function stripComments(
  source,
) {
  return source
    .replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    .replace(
      /(^|[^:])\/\/.*$/gm,
      '$1',
    )
}

test(
  'M18 keeps Customer Host Super Admin architecture and does not introduce B2B capability fields or activeMode authority',
  () => {
    const source =
      stripComments(
        [
          'src/modules/hospitality/hospitality.models.js',
          'src/modules/hospitality/hospitality.validation.js',
          'src/modules/hospitality/hospitality.service.js',
          'src/modules/hospitality/hospitality.routes.js',
        ]
          .map(
            read,
          )
          .join(
            '\n',
          ),
      )

    for (
      const forbidden of [
        'b2bEnabled',
        'sellerEnabled',
        'brandEnabled',
      ]
    ) {
      assert.equal(
        source.includes(
          forbidden,
        ),
        false,
      )
    }

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M18 Host API requires active Host capability MFA CSRF and recent MFA for writes',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.routes.js',
      )

    for (
      const token of [
        'authenticateSession',
        'loadCurrentUser',
        'requireActiveAccount',
        'requireHostAccess',
        'requireMfaAssurance',
        'requireCsrfToken',
        'requireRecentMfaAuthentication',
      ]
    ) {
      assert.equal(
        source.includes(
          token,
        ),
        true,
        `${token} must remain wired.`,
      )
    }
  },
)

test(
  'M18 private resource reads remain organization scoped',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      source,
      /organizationId:\s*context\.organization\._id/,
    )

    assert.match(
      source,
      /HOSPITALITY_OUTLET_SCOPE_REQUIRED/,
    )

    assert.match(
      source,
      /HOSPITALITY_ORGANIZATION_ACCESS_REQUIRED/,
    )
  },
)

test(
  'M18 never mutates canonical ProductVersion Pack Ingredient Dish or RecipeVersion truth',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    for (
      const model of [
        'ProductVersion',
        'Pack',
        'CanonicalIngredient',
        'Dish',
        'RecipeVersion',
      ]
    ) {
      assert.doesNotMatch(
        source,
        new RegExp(
          `(^|[^A-Za-z0-9_])${model}\\.(create|updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany)`,
          'm',
        ),
      )
    }
  },
)

test(
  'M18 Hospitality member grant mutation is organization-owner controlled',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      source,
      /assertOrganizationOwner/,
    )

    assert.match(
      source,
      /HOSPITALITY_ORGANIZATION_OWNER_REQUIRED/,
    )

    assert.match(
      source,
      /'hospitality\.read',[\s\S]{0,160}\.\.\.input\.permissionKeys/,
    )
  },
)

test(
  'M18 Supplier contract cost is independent from M05 Offer PriceRule and InventorySnapshot',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.service.js',
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

    assert.match(
      source,
      /supplierContractCostIsNotMarketplaceOfferPrice:\s*true/,
    )
  },
)

test(
  'M18 Production Recipe overlay does not write M07 RecipeVersion',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      source,
      /HospitalityProductionRecipeVersion\.create/,
    )

    assert.doesNotMatch(
      source,
      /(^|[^A-Za-z0-9_])RecipeVersion\.create/m,
    )

    assert.doesNotMatch(
      source,
      /(^|[^A-Za-z0-9_])RecipeVersion\.findOneAndUpdate/m,
    )
  },
)

test(
  'M18 procurement has no RFQ auction or autonomous purchase execution',
  () => {
    const source =
      read(
        'src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      source,
      /rfqAuctionImplemented:\s*false/,
    )

    assert.match(
      source,
      /automaticPurchaseOrderSubmission:\s*false/,
    )

    assert.doesNotMatch(
      source,
      /PurchaseOrder\.create/,
    )
  },
)

test(
  'M18 preserves M11 raw Razorpay webhook mount before global JSON parser',
  () => {
    const source =
      read(
        'src/app.js',
      )

    const webhookIndex =
      source.indexOf(
        "'/api/v1/webhooks'",
      )

    const jsonIndex =
      source.indexOf(
        'express.json',
      )

    assert.ok(
      webhookIndex >=
      0,
    )

    assert.ok(
      jsonIndex >
      webhookIndex,
    )

    assert.match(
      source,
      /hospitalityRoutes/,
    )

    assert.match(
      source,
      /['"]\/api\/v1\/host\/hospitality['"]/,
    )
  },
)