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
  'M22 Batch 1 registers only bounded execution collections and does not duplicate Marketplace Procurement Settlement or Ledger truth',
  () => {
    const models =
      readBackend(
        'src/modules/executionScale/executionScale.models.js',
      )

    for (
      const collection
      of [
        'partnerConnections',
        'partnerExecutionEvents',
        'purchaseOrders',
        'purchaseOrderEvents',
        'payoutExecutions',
        'reconciliationEvidence',
      ]
    ) {
      assert.match(
        models,

        new RegExp(
          `collection:\\s*['"]${collection}['"]`,
        ),
      )
    }

    assert.doesNotMatch(
      models,

      /collection:\s*['"]inventorySnapshots['"]|collection:\s*['"]settlements['"]|collection:\s*['"]hospitalityProcurementPlans['"]|collection:\s*['"]commerceLedgerEntries['"]/,
    )
  },
)

test(
  'M22 partner catalog and inventory sync delegate to frozen M16 and M05 services instead of direct canonical mutation',
  () => {
    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    assert.match(
      service,
      /createCatalogIngestJob/,
    )

    assert.match(
      service,
      /createBulkInventorySnapshots/,
    )

    assert.match(
      service,
      /sourceType:\s*['"]external_api['"]/,
    )

    assert.match(
      service,
      /canonicalProductVersionDirectMutation:\s*false/,
    )

    assert.match(
      service,
      /priceRuleDirectMutation:\s*false/,
    )
  },
)

test(
  'M22 preserves M11 external retailer handoff registry rather than creating a second Customer redirect registry',
  () => {
    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    const panel =
      readFrontend(
        'src/features/executionScale/components/ExecutionScalePanel.jsx',
      )

    assert.match(
      service,
      /listExternalCommercePartners/,
    )

    assert.match(
      panel,
      /COMMERCE_EXTERNAL_PARTNERS_JSON/,
    )
  },
)

test(
  'M22 partner connections store secret references not raw credentials and require HTTPS public targets plus Admin activation',
  () => {
    const models =
      readBackend(
        'src/modules/executionScale/executionScale.models.js',
      )

    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    assert.match(
      models,
      /credentialEnvKey/,
    )

    assert.match(
      models,
      /webhookSecretEnvKey/,
    )

    assert.doesNotMatch(
      models,
      /credentialSecret|accessToken|refreshToken|bankAccountNumber|cardNumber/,
    )

    assert.match(
      service,
      /M22_PARTNER_URL_HTTPS_REQUIRED/,
    )

    assert.match(
      service,
      /M22_PARTNER_URL_PRIVATE_NETWORK_FORBIDDEN/,
    )

    assert.match(
      service,
      /adminActivationRequired:\s*true/,
    )
  },
)

test(
  'M22 signed partner webhook is raw-body verified evidence-only and does not persist raw payload',
  () => {
    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    const routes =
      readBackend(
        'src/modules/executionScale/executionScale.routes.js',
      )

    assert.match(
      service,
      /createHmac\(\s*['"]sha256['"]/,
    )

    assert.match(
      service,
      /rawPayloadStored:\s*false/,
    )

    assert.match(
      service,
      /domainMutationPerformed:\s*false/,
    )

    assert.match(
      routes,
      /express\.raw/,
    )
  },
)

test(
  'M22 partner reliability composes M20 timeout circuit breaker instead of inventing a second retry engine',
  () => {
    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    assert.match(
      service,
      /executePartnerOperation/,
    )

    assert.match(
      service,
      /safeToRetry:\s*true/,
    )

    assert.match(
      service,
      /safeToRetry:\s*false/,
    )

    assert.match(
      service,
      /ambiguous/,
    )
  },
)

test(
  'M22 Purchase Orders derive from M18 Procurement Plan supplier selections without recalculating supplier choice',
  () => {
    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    assert.match(
      service,
      /HospitalityProcurementPlan/,
    )

    assert.match(
      service,
      /selectedSupplierId/,
    )

    assert.match(
      service,
      /selectedSupplierProductId/,
    )

    assert.match(
      service,
      /procurementDemandRecalculated:\s*false/,
    )

    assert.match(
      service,
      /supplierSelectionRecomputed:\s*false/,
    )
  },
)

test(
  'M22 Purchase Order approval requires maker checker and no automatic supplier submission',
  () => {
    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    assert.match(
      service,
      /M22_PURCHASE_ORDER_MAKER_CHECKER_REQUIRED/,
    )

    assert.match(
      service,
      /automaticPurchaseOrderSubmission:\s*false/,
    )

    assert.match(
      service,
      /aiPurchaseAuthority:\s*false/,
    )
  },
)

test(
  'M22 economic supplier submission is idempotent and never auto-retries ambiguous writes',
  () => {
    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    assert.match(
      service,
      /supplier_po_submit/,
    )

    assert.match(
      service,
      /['"]idempotency-key['"]/,
    )

    assert.match(
      service,
      /automaticRetryPerformed:\s*false/,
    )

    assert.match(
      service,
      /submission_ambiguous/,
    )
  },
)

test(
  'M22 payout execution consumes only approved M16 Settlement and never marks Settlement paid automatically',
  () => {
    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    assert.match(
      service,
      /HostSettlement/,
    )

    assert.match(
      service,
      /status:\s*['"]approved['"]/,
    )

    assert.match(
      service,
      /m16SettlementMarkedPaid:\s*false/,
    )

    assert.match(
      service,
      /existingM16PaidTransitionStillAuthoritative:\s*true/,
    )

    assert.doesNotMatch(
      service,
      /settlement\.status\s*=\s*['"]paid['"]/,
    )
  },
)

test(
  'M22 payout execution and reconciliation remain M03 finance mutate with MFA CSRF recent MFA and immutable audit',
  () => {
    const routes =
      readBackend(
        'src/modules/executionScale/executionScale.routes.js',
      )

    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    assert.match(
      routes,
      /finance\.mutate/,
    )

    assert.match(
      routes,
      /requireMfaAssurance/,
    )

    assert.match(
      routes,
      /requireRecentMfaAuthentication/,
    )

    assert.match(
      routes,
      /requireCsrfToken/,
    )

    assert.match(
      service,
      /recordAdminAuditEvent/,
    )
  },
)

test(
  'M22 reconciliation evidence and execution events are append only',
  () => {
    const models =
      readBackend(
        'src/modules/executionScale/executionScale.models.js',
      )

    assert.match(
      models,
      /protectAppendOnly\(\s*partnerExecutionEventSchema/,
    )

    assert.match(
      models,
      /protectAppendOnly\(\s*purchaseOrderEventSchema/,
    )

    assert.match(
      models,
      /protectAppendOnly\(\s*reconciliationEvidenceSchema/,
    )
  },
)

test(
  'M22 APIs are M17 feature flag gated but feature flags never become authorization authority',
  () => {
    const service =
      readBackend(
        'src/modules/executionScale/executionScale.service.js',
      )

    assert.match(
      service,
      /m22\.execution_scale/,
    )

    assert.match(
      service,
      /AdminFeatureFlag/,
    )

    assert.match(
      service,
      /featureFlagIsAuthorization:\s*false/,
    )
  },
)

test(
  'M22 app preserves M11 raw webhook boundary and mounts M22 raw webhook before JSON parsing',
  () => {
    const app =
      readBackend(
        'src/app.js',
      )

    const m11Webhook =
      app.indexOf(
        "'/api/v1/webhooks'",
      )

    const m22Webhook =
      app.indexOf(
        "'/api/v1/execution-scale/webhooks'",
      )

    const jsonParser =
      app.indexOf(
        'express.json',
      )

    assert.ok(
      m11Webhook >=
        0 &&
      m11Webhook <
        jsonParser,
    )

    assert.ok(
      m22Webhook >=
        0 &&
      m22Webhook <
        jsonParser,
    )

    assert.match(
      app,
      /executionScaleRoutes/,
    )
  },
)

test(
  'M22 frontend composes Execution Scale into Host dashboard while preserving M21 Retail Media route',
  () => {
    const shell =
      readFrontend(
        'src/features/host/components/HostShell.jsx',
      )

    const panel =
      readFrontend(
        'src/features/executionScale/components/ExecutionScalePanel.jsx',
      )

    assert.match(
      shell,
      /ExecutionScalePanel/,
    )

    assert.match(
      shell,
      /HostRetailMediaPage/,
    )

    assert.match(
      shell,
      /['"]\/host\/campaigns['"]/,
    )

    assert.match(
      shell,
      /['"]\/host\/operations['"]/,
    )

    assert.match(
      panel,
      /No supplier submission occurred automatically/,
    )

    assert.match(
      panel,
      /Provider confirmation is not settlement truth/,
    )
  },
)

test(
  'M22 Batch 1 preserves Customer Host Super Admin architecture and never authorizes using activeMode',
  () => {
    const source =
      stripComments(
        [
          readBackend(
            'src/modules/executionScale/executionScale.models.js',
          ),

          readBackend(
            'src/modules/executionScale/executionScale.service.js',
          ),

          readBackend(
            'src/modules/executionScale/executionScale.routes.js',
          ),

          readFrontend(
            'src/features/executionScale/components/ExecutionScalePanel.jsx',
          ),

          readFrontend(
            'src/features/executionScale/services/executionScale.service.js',
          ),
        ].join(
          '\n',
        ),
      )

    for (
      const forbidden
      of [
        'sellerEnabled',
        'brandEnabled',
        'b2bEnabled',
        'supplierEnabled',
        'retailerEnabled',
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

      /activeMode\s*===\s*['"]host['"]|activeMode\s*!==\s*['"]host['"]/,
    )
  },
)