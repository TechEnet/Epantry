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
  'M21 Batch 1 creates only receiptImports and householdMemoryFacts as new expansion collections',
  () => {
    const models =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.models.js',
      )

    assert.match(
      models,
      /collection:\s*['"]receiptImports['"]/,
    )

    assert.match(
      models,
      /collection:\s*['"]householdMemoryFacts['"]/,
    )

    assert.doesNotMatch(
      models,
      /collection:\s*['"]pantryItems['"]|collection:\s*['"]pantryObservations['"]|collection:\s*['"]mealPlans['"]/,
    )
  },
)

test(
  'M21 receipt intelligence reuses M09 Pantry observations and requires Customer review before projection',
  () => {
    const service =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.service.js',
      )

    assert.match(
      service,
      /createPantryObservationForHousehold/,
    )

    assert.match(
      service,
      /sourceType:\s*['"]receipt_import['"]/,
    )

    assert.match(
      service,
      /receiptLinesRequireCustomerReviewBeforePantryProjection:\s*true/,
    )

    assert.match(
      service,
      /unresolvedMatchMayCreateCanonicalTruth:\s*false/,
    )
  },
)

test(
  'M21 receipt import requires current privacy consent plus explicit source acknowledgement',
  () => {
    const service =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.service.js',
      )

    const routes =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.routes.js',
      )

    assert.match(
      service,
      /M21_PRIVACY_CONSENT_REQUIRED/,
    )

    assert.match(
      routes,
      /explicitImportAcknowledged:\s*z\.literal\(\s*true/,
    )
  },
)

test(
  'M21 household memory is personalization-consent gated and remains non-authoritative',
  () => {
    const service =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.service.js',
      )

    assert.match(
      service,
      /M21_PERSONALIZATION_CONSENT_REQUIRED/,
    )

    assert.match(
      service,
      /predictionIsInventoryTruth:\s*false/,
    )

    assert.match(
      service,
      /predictionMayAuthorizePurchase:\s*false/,
    )

    assert.match(
      service,
      /automaticPurchase:\s*false/,
    )
  },
)

test(
  'M21 Customer can pause resume or forget learned household memory',
  () => {
    const routes =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.routes.js',
      )

    const service =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.service.js',
      )

    for (
      const action of [
        'pause',
        'resume',
        'forget',
      ]
    ) {
      assert.equal(
        routes.includes(
          `'${action}'`,
        ),
        true,
      )
    }

    assert.match(
      service,
      /fact\.evidenceRefs\s*=\s*\[\]/,
    )

    assert.match(
      service,
      /fact\.canonicalPackId\s*=\s*null/,
    )
  },
)

test(
  'M21 explicit leftover state requires Customer evidence and does not invent Pantry quantity',
  () => {
    const service =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.service.js',
      )

    assert.match(
      service,
      /sourceType:\s*['"]customer_leftover['"]/,
    )

    assert.match(
      service,
      /explicitCustomerLeftover:\s*true/,
    )

    assert.match(
      service,
      /inferredLeftoverQuantity:\s*false/,
    )

    assert.match(
      service,
      /automaticPantryMutation:\s*false/,
    )
  },
)

test(
  'M21 advanced planning composes M13 instead of creating parallel Meal Plan or commerce authority',
  () => {
    const service =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.service.js',
      )

    assert.match(
      service,
      /getWasteReduction/,
    )

    assert.match(
      service,
      /getNextPossibility/,
    )

    assert.match(
      service,
      /getNextBasket/,
    )

    assert.match(
      service,
      /composesM13InsteadOfReplacingIt:\s*true/,
    )

    assert.match(
      service,
      /automaticCart:\s*false/,
    )

    assert.match(
      service,
      /automaticCheckout:\s*false/,
    )
  },
)

test(
  'M21 advanced routes remain inside frozen Customer Pantry authorization boundary and writes use CSRF',
  () => {
    const pantryRoutes =
      readBackend(
        'src/modules/pantry/pantry.routes.js',
      )

    const advancedRoutes =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.routes.js',
      )

    assert.match(
      pantryRoutes,
      /requireCustomerAccess/,
    )

    assert.match(
      pantryRoutes,
      /['"]\/intelligence['"]\s*,\s*advancedExpansionRoutes/,
    )

    assert.match(
      advancedRoutes,
      /requireCsrfToken/,
    )
  },
)

test(
  'M21 Batch 1 preserves Customer Host Super Admin top-level access and never authorizes with activeMode',
  () => {
    const source =
      stripComments(
        [
          readBackend(
            'src/modules/advancedExpansion/advancedExpansion.models.js',
          ),

          readBackend(
            'src/modules/advancedExpansion/advancedExpansion.service.js',
          ),

          readBackend(
            'src/modules/advancedExpansion/advancedExpansion.routes.js',
          ),

          readFrontend(
            'src/features/advancedExpansion/components/AdvancedPantryPanel.jsx',
          ),

          readFrontend(
            'src/features/advancedExpansion/services/advancedExpansion.service.js',
          ),
        ].join(
          '\n',
        ),
      )

    for (
      const forbidden of [
        'sellerEnabled',
        'brandEnabled',
        'b2bEnabled',
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

test(
  'M21 advanced Pantry APIs remain behind the existing M17 feature flag plane',
  () => {
    const service =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.service.js',
      )

    const routes =
      readBackend(
        'src/modules/advancedExpansion/advancedExpansion.routes.js',
      )

    const pantryPage =
      readFrontend(
        'src/features/pantry/pages/PantryPage.jsx',
      )

    assert.match(
      service,
      /m21\.advanced_pantry/,
    )

    assert.match(
      service,
      /collection\(\s*['"]featureFlags['"]\s*,?\s*\)/,
    )

    assert.match(
      routes,
      /requireM21AdvancedPantryFeature/,
    )

    assert.match(
      pantryPage,
      /featureFlags\?\.\[\s*['"]m21\.advanced_pantry['"]\s*\]/,
    )
  },
)

test(
  'M21 frontend makes receipt review prediction and no-auto-purchase boundaries explicit',
  () => {
    const panel =
      readFrontend(
        'src/features/advancedExpansion/components/AdvancedPantryPanel.jsx',
      )

    assert.match(
      panel,
      /Nothing was added to Pantry automatically/,
    )

    assert.match(
      panel,
      /Prediction ≠ inventory truth/,
    )

    assert.match(
      panel,
      /No automatic Meal Plan change, Cart, Checkout or purchase occurs here/,
    )
  },
)