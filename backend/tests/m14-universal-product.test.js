import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  fileURLToPath,
} from 'node:url'

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

const projectRoot =
  path.resolve(
    backendRoot,
    '..',
  )

function readBackend(
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

function readFrontend(
  relativePath,
) {
  return fs.readFileSync(
    path.join(
      projectRoot,
      'frontend',
      relativePath,
    ),
    'utf8',
  )
}

test(
  'M14 barcode resolver keeps bounded normalization and supported GTIN validation',
  () => {
    const source =
      readBackend(
        'src/modules/universalProduct/universalProduct.service.js',
      )

    assert.match(
      source,
      /NUMERIC_PRODUCT_CODE_PATTERN/,
    )

    assert.match(
      source,
      /replace\(\s*\/\\s\+\/g/,
    )

    assert.match(
      source,
      /slice\(\s*0,\s*180/,
    )
  },
)

test(
  'M14 registers evidence, match, draft, extraction and review collections',
  () => {
    const source =
      readBackend(
        'src/modules/universalProduct/universalProduct.models.js',
      )

    for (
      const collection of [
        'productIdentities',
        'barcodeObservations',
        'productIdentityMatches',
        'imageEvidence',
        'communityProductDrafts',
        'npiJobs',
        'labelExtractions',
        'productNpiReviewDecisions',
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          collection,
        ),
      )
    }
  },
)

test(
  'M14 supports verified current, verified historical and provisional barcode resolution states',
  () => {
    const source =
      readBackend(
        'src/modules/universalProduct/universalProduct.models.js',
      )

    for (
      const state of [
        'verified_current',
        'verified_historical',
        'provisional_external',
        'unresolved',
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          state,
        ),
      )
    }
  },
)

test(
  'M14 exposes Customer Scan Anything and Product Passport APIs',
  () => {
    const source =
      readBackend(
        'src/modules/universalProduct/universalProduct.routes.js',
      )

    for (
      const route of [
        '/universal-product/resolve-barcode',
        '/universal-product/image-upload-intent',
        '/universal-product/resolve-image',
        '/universal-product/drafts/:id',
        '/products/:id/passport',
        '/products/:id/add-to-pantry',
      ]
    ) {
      assert.equal(
        source.includes(
          route,
        ),
        true,
        `${route} must be present.`,
      )
    }
  },
)

test(
  'M14 exposes Host NPI and M03 Admin review surfaces without new top-level roles',
  () => {
    const source =
      readBackend(
        'src/modules/universalProduct/universalProduct.routes.js',
      )

    assert.match(
      source,
      /router\.use\(\s*['"]\/host['"]/,
    )

    assert.match(
      source,
      /router\.use\(\s*['"]\/admin\/product-intelligence['"]/,
    )

    assert.doesNotMatch(
      source,
      /sellerEnabled|brandEnabled|b2bEnabled|sellerAccessStatus|brandAccessStatus|b2bAccessStatus/,
    )
  },
)

test(
  'M14 frontend service supports signed evidence upload, Scan, Passport, Host NPI and Admin review',
  () => {
    const source =
      readFrontend(
        'src/features/universalProduct/services/universalProduct.service.js',
      )

    for (
      const value of [
        '/universal-product/resolve-barcode',
        '/universal-product/resolve-image',
        '/products/',
        '/host/universal-product/npi/resolve-image',
        '/admin/product-intelligence/review-queue',
        '/auth/csrf',
        'x-csrf-token',
        'FormData',
      ]
    ) {
      assert.equal(
        source.includes(
          value,
        ),
        true,
        `frontend M14 service must contain ${value}`,
      )
    }
  },
)

test(
  'M14 customer UI includes camera fallback, package evidence guidance and explicit provisional language',
  () => {
    const source =
      readFrontend(
        'src/features/universalProduct/pages/ScanAnythingPage.jsx',
      )

    for (
      const value of [
        'BarcodeDetector',
        'getUserMedia',
        'Front of pack',
        'Ingredients panel',
        'Allergen statement',
        'Nutrition panel',
        'Unverified',
        'Provisional',
      ]
    ) {
      assert.equal(
        source.includes(
          value,
        ),
        true,
        `Scan Anything must contain ${value}`,
      )
    }
  },
)

test(
  'M14 Product Passport UI shows historical timeline, evidence state, allergens and add-to-pantry',
  () => {
    const source =
      readFrontend(
        'src/features/universalProduct/pages/ProductPassportPage.jsx',
      )

    for (
      const value of [
        'Historical pack timeline',
        'Evidence status',
        'Allergen coverage',
        'Add to Pantry',
        'unknown / not declared',
      ]
    ) {
      assert.equal(
        source
          .toLowerCase()
          .includes(
            value.toLowerCase(),
          ),
        true,
      )
    }
  },
)