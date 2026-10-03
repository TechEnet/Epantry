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

function legacyHospitalitySource() {
  const source =
    read(
      'src/modules/hospitality/hospitality.service.js',
    )

  const restaurantSectionIndex =
    source.indexOf(
      '| M5-B Restaurant Recipe Listings',
    )

  assert.ok(
    restaurantSectionIndex > 0,
    'M5-B Restaurant Recipe section must remain explicitly separated from the legacy M18 Hospitality engine.',
  )

  return source.slice(
    0,
    restaurantSectionIndex,
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
  'M18 legacy engine never mutates canonical ProductVersion Pack or Ingredient truth and only creates internal Dish Recipe lineage',
  () => {
    const source =
      legacyHospitalitySource()

    for (
      const model of [
        'ProductVersion',
        'Pack',
        'CanonicalIngredient',
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

    assert.match(
      source,
      /Dish\.create/,
    )

    assert.match(
      source,
      /RecipeVersion\.create/,
    )

    for (
      const model of [
        'Dish',
        'RecipeVersion',
      ]
    ) {
      assert.doesNotMatch(
        source,
        new RegExp(
          `(^|[^A-Za-z0-9_])${model}\\.(updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany)`,
          'm',
        ),
      )
    }

    assert.match(
      source,
      /Internal Hospitality lineage record\. This Dish is not a public customer recipe listing\./,
    )
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
  'M18 Production Recipe keeps the Hospitality version and may materialize non-public M07 lineage without rewriting it',
  () => {
    const source =
      legacyHospitalitySource()

    assert.match(
      source,
      /HospitalityProductionRecipeVersion\.create/,
    )

    assert.match(
      source,
      /RecipeVersion\.create/,
    )

    assert.doesNotMatch(
      source,
      /(^|[^A-Za-z0-9_])RecipeVersion\.(findOneAndUpdate|updateOne|updateMany|deleteOne|deleteMany)/m,
    )

    assert.match(
      source,
      /Internal governed recipe lineage generated from a Super Admin-approved Hospitality kitchen recipe\./,
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