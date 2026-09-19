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

function readProjectFile(
  relativePath,
) {
  return fs.readFileSync(
    path.join(
      projectRoot,
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
  'M14 Final is mounted behind sensitive no-store middleware',
  () => {
    const source =
      readProjectFile(
        'backend/src/app.js',
      )

    assert.match(
      source,
      /universalProductRoutes/,
    )

    assert.match(
      source,
      /sensitiveResponseNoStoreMiddleware[\s\S]*?universalProductRoutes/,
    )
  },
)

test(
  'M14 Final Customer authorization uses Customer capability and never activeMode',
  () => {
    const source =
      stripComments(
        readProjectFile(
          'backend/src/modules/universalProduct/universalProduct.routes.js',
        ),
      )

    for (
      const value of [
        'authenticateSession',
        'loadCurrentUser',
        'requireActiveAccount',
        'requireCustomerAccess',
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          value,
        ),
      )
    }

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M14 Final Host NPI requires backend Host capability and MFA while activeMode remains irrelevant',
  () => {
    const source =
      stripComments(
        readProjectFile(
          'backend/src/modules/universalProduct/universalProduct.routes.js',
        ),
      )

    assert.match(
      source,
      /hostRouter\.use\([\s\S]*?requireHostAccess[\s\S]*?requireMfaAssurance/,
    )

    assert.doesNotMatch(
      source,
      /activeMode/,
    )

    const npiSource =
      readProjectFile(
        'backend/src/modules/universalProduct/universalProduct.npi.service.js',
      )

    assert.match(
      npiSource,
      /requireActiveHostMarketplaceOrganization/,
    )

    assert.match(
      npiSource,
      /BrandAuthorityGrant/,
    )

    assert.match(
      npiSource,
      /status:\s*['"]active['"]/,
    )
  },
)

test(
  'M14 Final internal Admin authority stays inside the M03 permission engine',
  () => {
    const source =
      stripComments(
        readProjectFile(
          'backend/src/modules/universalProduct/universalProduct.routes.js',
        ),
      )

    for (
      const value of [
        'loadAdminAuthorization',
        'requireAdminAccess',
        'requireAnyAdminPermission',
        'catalog.read',
        'catalog.mutate',
        'trust_safety.read',
        'trust_safety.mutate',
        'requireRecentMfaAuthentication',
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          value.replace(
            '.',
            '\\.',
          ),
        ),
      )
    }
  },
)

test(
  'M14 Final AI and external evidence cannot auto-create or auto-publish canonical ProductVersion truth',
  () => {
    const files = [
      'backend/src/modules/universalProduct/universalProduct.service.js',
      'backend/src/modules/universalProduct/universalProduct.npi.service.js',
      'backend/src/modules/universalProduct/universalProduct.routes.js',
      'backend/src/integrations/productData/openFoodFacts.provider.js',
    ]

    for (
      const file of files
    ) {
      const source =
        stripComments(
          readProjectFile(
            file,
          ),
        )

      assert.doesNotMatch(
        source,
        /ProductVersion\.(?:create|insertMany|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|deleteOne|deleteMany)/,
        `${file} must not mutate canonical ProductVersion truth.`,
      )
    }

    const npiSource =
      readProjectFile(
        'backend/src/modules/universalProduct/universalProduct.npi.service.js',
      )

    assert.match(
      npiSource,
      /approved_for_catalog/,
    )

    assert.match(
      npiSource,
      /canonicalPublishPerformed:\s*false/,
    )
  },
)

test(
  'M14 Final low-confidence or present safety fields remain human review gated',
  () => {
    const source =
      readProjectFile(
        'backend/src/modules/universalProduct/universalProduct.npi.service.js',
      )

    for (
      const field of [
        'ingredientDeclarationText',
        'allergens',
        'nutrition',
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          field,
        ),
      )
    }

    assert.match(
      source,
      /SAFETY_FIELD_REVIEW_REQUIRED/,
    )

    assert.match(
      source,
      /NPI_SAFETY_REVIEW_REQUIRED/,
    )

    assert.match(
      source,
      /reviewState ===[\s\S]*?['"]accepted['"]/,
    )
  },
)

test(
  'M14 Final Product Passport derives history from immutable published ProductVersion records',
  () => {
    const source =
      readProjectFile(
        'backend/src/modules/universalProduct/universalProduct.service.js',
      )

    assert.match(
      source,
      /ProductVersion[\s\S]*?find\(\{[\s\S]*?packId:/,
    )

    assert.match(
      source,
      /publicationStatus:\s*['"]published['"]/,
    )

    assert.match(
      source,
      /historicalFormulationIsImmutable:\s*true/,
    )

    assert.doesNotMatch(
      readProjectFile(
        'backend/src/modules/universalProduct/universalProduct.models.js',
      ),
      /collection:\s*['"]historicalProductVersions['"]/,
    )
  },
)

test(
  'M14 Final evidence upload is private authenticated image storage with bounded type and size',
  () => {
    const source =
      readProjectFile(
        'backend/src/integrations/media/cloudinary.provider.js',
      )

    assert.match(
      source,
      /type:\s*['"]authenticated['"]/,
    )

    assert.match(
      source,
      /image\/jpeg/,
    )

    assert.match(
      source,
      /image\/png/,
    )

    assert.match(
      source,
      /image\/webp/,
    )

    assert.match(
      source,
      /8\s*\*\s*1024\s*\*\s*1024/,
    )

    assert.match(
      source,
      /timingSafeEqual/,
    )
  },
)

test(
  'M14 Final Open Food Facts fallback stays explicitly unverified and provisional',
  () => {
    const provider =
      readProjectFile(
        'backend/src/integrations/productData/openFoodFacts.provider.js',
      )

    const service =
      readProjectFile(
        'backend/src/modules/universalProduct/universalProduct.service.js',
      )

    assert.match(
      provider,
      /verificationStatus:\s*['"]unverified['"]/,
    )

    assert.match(
      service,
      /provisional_external/,
    )

    assert.match(
      service,
      /EXTERNAL_FACTS_REQUIRE_REVIEW/,
    )
  },
)

test(
  'M14 Final frontend routes follow Customer Host and M03 Admin boundaries',
  () => {
    const source =
      readProjectFile(
        'frontend/src/routes/AppRoutes.jsx',
      )

    const scanIndex =
      source.indexOf(
        'path="/scan"',
      )

    assert.notEqual(
      scanIndex,
      -1,
    )

    assert.match(
      source.slice(
        scanIndex,
        scanIndex +
          600,
      ),
      /APPLICATION_ACCESS_TYPES\.CUSTOMER/,
    )

    const hostIndex =
      source.indexOf(
        'path="/host/product-intelligence"',
      )

    assert.notEqual(
      hostIndex,
      -1,
    )

    assert.match(
      source.slice(
        hostIndex,
        hostIndex +
          700,
      ),
      /APPLICATION_ACCESS_TYPES\.HOST/,
    )

    const adminIndex =
      source.indexOf(
        'path="/admin/product-intelligence"',
      )

    assert.notEqual(
      adminIndex,
      -1,
    )

    assert.match(
      source.slice(
        adminIndex,
        adminIndex +
          700,
      ),
      /catalog\.read/,
    )

    assert.match(
      source.slice(
        adminIndex,
        adminIndex +
          700,
      ),
      /trust_safety\.read/,
    )
  },
)

test(
  'M14 Final frontend never contains OpenRouter or Cloudinary secrets',
  () => {
    const files = [
      'frontend/src/features/universalProduct/services/universalProduct.service.js',
      'frontend/src/features/universalProduct/pages/ScanAnythingPage.jsx',
      'frontend/src/features/universalProduct/pages/HostNpiPage.jsx',
      'frontend/src/features/universalProduct/pages/AdminNpiReviewPage.jsx',
    ]

    for (
      const file of files
    ) {
      const source =
        readProjectFile(
          file,
        )

      assert.doesNotMatch(
        source,
        /OPENROUTER_API_KEY|CLOUDINARY_API_SECRET|VITE_OPENROUTER|VITE_CLOUDINARY_API_SECRET/,
      )
    }
  },
)