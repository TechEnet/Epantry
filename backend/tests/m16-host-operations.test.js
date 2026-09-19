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

const projectRoot =
  path.resolve(
    backendRoot,
    '..',
  )

function readBackend(relativePath) {
  return fs.readFileSync(
    path.join(
      backendRoot,
      relativePath,
    ),
    'utf8',
  )
}

function readFrontend(relativePath) {
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
  'M16 finance persists settlement batches, append-only lines and events',
  () => {
    const source =
      readBackend(
        'src/modules/hostOperations/hostOperations.finance.models.js',
      )

    for (const collection of [
      'settlements',
      'settlementLines',
      'settlementEvents',
    ]) {
      assert.match(
        source,
        new RegExp(
          `collection:\\s*['"]${collection}['"]`,
        ),
      )
    }

    assert.match(
      source,
      /Settlement line.*append-only|appendOnlyGuard/s,
    )
  },
)

test(
  'M16 finance reconciles frozen M11 SellerOrder and CommerceLedgerEntry truth',
  () => {
    const source =
      readBackend(
        'src/modules/hostOperations/hostOperations.finance.service.js',
      )

    assert.match(
      source,
      /SellerOrder/,
    )

    assert.match(
      source,
      /CommerceLedgerEntry/,
    )

    assert.match(
      source,
      /status:\s*['"]delivered['"]/,
    )

    assert.match(
      source,
      /entryType:\s*['"]payment_captured['"]/,
    )

    assert.doesNotMatch(
      source,
      /CommerceLedgerEntry\.(update|delete|findOneAndUpdate)/,
    )
  },
)

test(
  'M16 settlements enforce maker-checker and do not execute provider payouts',
  () => {
    const source =
      readBackend(
        'src/modules/hostOperations/hostOperations.finance.service.js',
      )

    assert.match(
      source,
      /FINANCE_SETTLEMENT_MAKER_CHECKER_REQUIRED/,
    )

    assert.match(
      source,
      /createdByUserId/,
    )

    assert.match(
      source,
      /checkerUserId/,
    )

    assert.match(
      source,
      /providerExecutionPerformed:\s*false/,
    )
  },
)

test(
  'M16 Service Accounts store hashed credentials with explicit scopes',
  () => {
    const models =
      readBackend(
        'src/modules/hostOperations/hostOperations.integration.models.js',
      )

    const service =
      readBackend(
        'src/modules/hostOperations/hostOperations.integration.service.js',
      )

    assert.match(
      models,
      /collection:\s*['"]serviceAccounts['"]/,
    )

    assert.match(
      models,
      /collection:\s*['"]apiCredentials['"]/,
    )

    assert.match(
      models,
      /HOST_SERVICE_ACCOUNT_SCOPES/,
    )

    assert.match(
      service,
      /secretHashSha256/,
    )

    assert.match(
      service,
      /secretVisibility:\s*['"]shown_once['"]/,
    )

    assert.doesNotMatch(
      models,
      /secretPlaintext|rawSecret/,
    )
  },
)

test(
  'M16 webhooks encrypt signing secrets at rest and require HTTPS outside local dev',
  () => {
    const service =
      readBackend(
        'src/modules/hostOperations/hostOperations.integration.service.js',
      )

    assert.match(
      service,
      /aes-256-gcm/,
    )

    assert.match(
      service,
      /HOST_WEBHOOK_SECRET_ENCRYPTION_KEY/,
    )

    assert.match(
      service,
      /HOST_WEBHOOK_HTTPS_REQUIRED/,
    )

    assert.match(
      service,
      /signingSecretCiphertext/,
    )
  },
)

test(
  'M16 exposes service-account authentication and scope middleware',
  () => {
    const middleware =
      readBackend(
        'src/modules/hostOperations/hostOperations.integration.middleware.js',
      )

    const routes =
      readBackend(
        'src/modules/hostOperations/hostOperations.integration.routes.js',
      )

    assert.match(
      middleware,
      /authenticateHostServiceAccount/,
    )

    assert.match(
      middleware,
      /requireHostServiceAccountScope/,
    )

    assert.match(
      routes,
      /['"]\/host-service['"]/,
    )

    assert.match(
      routes,
      /['"]\/whoami['"]/,
    )
  },
)

test(
  'M16 HostShell exposes S01-S11 operational navigation',
  () => {
    const source =
      readFrontend(
        'src/features/host/components/HostShell.jsx',
      )

    for (const screen of [
      'S01 Dashboard',
      'S02 Catalog',
      'S03 Product Editor / NPI',
      'S04 Data Quality',
      'S05 Pricing & Inventory',
      'S06 Orders',
      'S07 Fulfillment',
      'S08 Finance',
      'S09 Brand Recipes',
      'S10 Campaigns',
      'S11 Documents / Team / API',
    ]) {
      assert.equal(
        source.includes(
          screen,
        ),
        true,
        `${screen} must remain visible in HostShell.`,
      )
    }
  },
)

test(
  'M16 frontend routes compose frozen M05 M11 M14 screens with new Host Operations pages',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    for (const route of [
      'path="/host/operations"',
      'path="/host/catalog"',
      'path="/host/product-intelligence"',
      'path="/host/data-quality"',
      'path="/host/marketplace"',
      'path="/host/orders"',
      'path="/host/fulfillment"',
      'path="/host/finance"',
      'path="/host/brand-recipes"',
      'path="/host/campaigns"',
      'path="/host/settings"',
    ]) {
      assert.equal(
        source.includes(
          route,
        ),
        true,
        `${route} must exist.`,
      )
    }
  },
)

test(
  'M16 Admin Host Operations route is permission gated',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    const index =
      source.indexOf(
        'path="/admin/host-operations"',
      )

    assert.notEqual(
      index,
      -1,
    )

    const block =
      source.slice(
        index,
        index +
          650,
      )

    assert.match(
      block,
      /marketplace\.read/,
    )

    assert.match(
      block,
      /finance\.read/,
    )

    assert.match(
      block,
      /recipe\.read/,
    )
  },
)

test(
  'M16 Host operations UI keeps retail media as a disclosed future seam',
  () => {
    const source =
      readFrontend(
        'src/features/hostOperations/pages/HostOperationsPage.jsx',
      )

    assert.match(
      source,
      /does not implement auction, paid ranking, ROAS attribution or ad serving/,
    )

    assert.match(
      source,
      /Commercial disclosure/,
    )
  },
)