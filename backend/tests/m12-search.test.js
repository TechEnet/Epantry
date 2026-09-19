import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  fileURLToPath,
} from 'node:url'

import {
  explainReasonCodes,
  mergeSearchIntent,
  parseDeterministicSearchIntent,
  redactSearchTextForPersistence,
  sortSearchCandidates,
} from '../src/modules/search/search.engine.js'

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

function stripJsComments(
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
  'M12 registers Search session event candidate ranking and AI interaction collections',
  () => {
    const source =
      readBackend(
        'src/modules/search/search.models.js',
      )

    for (
      const collection
      of [
        'searchSessions',
        'searchEvents',
        'candidateSets',
        'rankingDecisions',
        'aiInteractions',
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
  'M12 Search evidence records remain append-only while SearchSession can evolve',
  () => {
    const source =
      readBackend(
        'src/modules/search/search.models.js',
      )

    assert.match(
      source,
      /blockAppendOnlyMutation\(\s*searchEventSchema/,
    )

    assert.match(
      source,
      /blockAppendOnlyMutation\(\s*candidateSetSchema/,
    )

    assert.match(
      source,
      /blockAppendOnlyMutation\(\s*rankingDecisionSchema/,
    )

    assert.match(
      source,
      /blockAppendOnlyMutation\(\s*aiInteractionSchema/,
    )

    assert.doesNotMatch(
      source,
      /blockAppendOnlyMutation\(\s*searchSessionSchema/,
    )
  },
)

test(
  'M12 parses documented Hinglish dinner intent deterministically',
  () => {
    const intent =
      parseDeterministicSearchIntent(
        '20 min me 4 logon ke liye paneer aur spinach se dinner under 800',
      )

    assert.equal(
      intent.constraints.maxTimeMinutes,
      20,
    )

    assert.equal(
      intent.constraints.servings,
      4,
    )

    assert.equal(
      intent.constraints.budgetMinor,
      80000,
    )

    assert.equal(
      intent.constraints.course,
      'dinner',
    )

    assert.ok(
      intent.contentTerms.includes(
        'paneer',
      ),
    )

    assert.ok(
      intent.contentTerms.includes(
        'spinach',
      ),
    )
  },
)

test(
  'M12 parses cuisine and time without an LLM',
  () => {
    const intent =
      parseDeterministicSearchIntent(
        'South Indian breakfast in 20 minutes',
      )

    assert.equal(
      intent.constraints.cuisine,
      'south indian',
    )

    assert.equal(
      intent.constraints.course,
      'breakfast',
    )

    assert.equal(
      intent.constraints.maxTimeMinutes,
      20,
    )
  },
)

test(
  'M12 treats explicit allergen exclusion as a hard structured constraint',
  () => {
    const intent =
      parseDeterministicSearchIntent(
        'vegetarian dinner no nuts',
      )

    assert.deepEqual(
      intent.constraints.dietaryKeys,
      [
        'vegetarian',
      ],
    )

    assert.deepEqual(
      intent.constraints.excludedAllergens,
      [
        'nuts',
      ],
    )
  },
)

test(
  'M12 detects explicit Pantry and one-retailer intents without making either an authorization role',
  () => {
    const intent =
      parseDeterministicSearchIntent(
        'use what I already have and one retailer only',
      )

    assert.equal(
      intent.constraints.usePantry,
      true,
    )

    assert.equal(
      intent.constraints.commerceObjective,
      'one_retailer',
    )
  },
)

test(
  'M12 conversational refinement merges with existing structured intent',
  () => {
    const baseIntent =
      parseDeterministicSearchIntent(
        'paneer dinner for 4',
      )

    const refinementIntent =
      parseDeterministicSearchIntent(
        'quicker and less spicy',
      )

    const merged =
      mergeSearchIntent({
        baseIntent,
        refinementIntent,
      })

    assert.equal(
      merged.constraints.servings,
      4,
    )

    assert.ok(
      merged.contentTerms.includes(
        'paneer',
      ),
    )

    assert.ok(
      merged.constraints.preferenceSignals.includes(
        'prefer_quicker',
      ),
    )

    assert.ok(
      merged.constraints.preferenceSignals.includes(
        'prefer_less_spicy',
      ),
    )
  },
)

test(
  'M12 persistence redacts obvious email and Indian phone identifiers',
  () => {
    const value =
      redactSearchTextForPersistence(
        'paneer for a@b.com call 9876543210',
      )

    assert.doesNotMatch(
      value,
      /a@b\.com/,
    )

    assert.doesNotMatch(
      value,
      /9876543210/,
    )

    assert.match(
      value,
      /\[redacted-email\]/,
    )

    assert.match(
      value,
      /\[redacted-phone\]/,
    )
  },
)

test(
  'M12 organic ranking is deterministic and score ordered',
  () => {
    const sorted =
      sortSearchCandidates([
        {
          type:
            'brand',

          id:
            'b',

          displayName:
            'B',

          score:
            10,
        },

        {
          type:
            'recipe',

          id:
            'a',

          displayName:
            'A',

          score:
            20,
        },
      ])

    assert.equal(
      sorted[0].id,
      'a',
    )
  },
)

test(
  'M12 decision explanation comes from recorded reason codes not generated claims',
  () => {
    const reasons =
      explainReasonCodes([
        'TIME_WITHIN_LIMIT',
        'COURSE_MATCH',
      ])

    assert.equal(
      reasons.length,
      2,
    )

    assert.match(
      reasons[0].text,
      /published|stated/i,
    )
  },
)

test(
  'M12 public Search schemas are strict and do not accept ownership price stock or admin authority injection',
  () => {
    const source =
      stripJsComments(
        readBackend(
          'src/modules/search/search.routes.js',
        ),
      )

    assert.match(
      source,
      /smartSearchBodySchema[\s\S]*?\.strict\(\)/,
    )

    assert.match(
      source,
      /searchRefineBodySchema[\s\S]*?\.strict\(\)/,
    )

    assert.match(
      source,
      /decisionExplainBodySchema[\s\S]*?\.strict\(\)/,
    )

    assert.doesNotMatch(
      source,
      /ownerUserId\s*:/,
    )

    assert.doesNotMatch(
      source,
      /householdId\s*:/,
    )

    assert.doesNotMatch(
      source,
      /priceMinor\s*:/,
    )

    assert.doesNotMatch(
      source,
      /stockQuantity\s*:/,
    )
  },
)

test(
  'M12 exposes documented Search refine and decision explain APIs',
  () => {
    const source =
      readBackend(
        'src/modules/search/search.routes.js',
      )

    assert.match(
      source,
      /'\/search'/,
    )

    assert.match(
      source,
      /'\/search\/refine'/,
    )

    assert.match(
      source,
      /'\/decision-explain'/,
    )
  },
)

test(
  'M12 Search is Guest-safe and only unlocks Household context through Customer capability',
  () => {
    const source =
      stripJsComments(
        readBackend(
          'src/modules/search/search.routes.js',
        ),
      )

    assert.match(
      source,
      /actorType:\s*'guest'/,
    )

    assert.match(
      source,
      /userHasAnyAccess\(\s*user,\s*'customer'/,
    )

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M12 Search creates no Seller Brand or B2B top-level application authority',
  () => {
    const source =
      stripJsComments(
        readBackend(
          'src/modules/search/search.routes.js',
        ),
      )

    assert.doesNotMatch(
      source,
      /requireSellerAccess|requireBrandAccess|requireB2BAccess/i,
    )

    assert.doesNotMatch(
      source,
      /actorType:\s*['"](?:seller|brand|b2b)['"]/i,
    )
  },
)

test(
  'M12 Search composes frozen Product Recipe Pantry and What Should We Cook services',
  () => {
    const source =
      readBackend(
        'src/modules/search/search.service.js',
      )

    assert.match(
      source,
      /listPublicProducts/,
    )

    assert.match(
      source,
      /listPublicRecipes/,
    )

    assert.match(
      source,
      /getWhatShouldWeCook/,
    )

    assert.match(
      source,
      /listPantryItems/,
    )
  },
)

test(
  'M12 hard food constraints are verified through governed Food Intelligence outside the LLM',
  () => {
    const source =
      readBackend(
        'src/modules/search/search.service.js',
      )

    assert.match(
      source,
      /getPublicRecipeFoodIntelligence/,
    )

    assert.match(
      source,
      /getPublicProductFoodIntelligence/,
    )

    assert.match(
      source,
      /ALLERGEN_FREE_STATUS_NOT_VERIFIED/,
    )

    assert.match(
      source,
      /DIETARY_CONSTRAINT_NOT_VERIFIED/,
    )
  },
)

test(
  'M12 does not treat an empty allergen relationship list as a verified free-from claim',
  () => {
    const source =
      readBackend(
        'src/modules/search/search.service.js',
      )

    assert.match(
      source,
      /ALLERGEN_FREE_RULE_KEYS/,
    )

    assert.match(
      source,
      /dietaryRuleIsEligible/,
    )

    assert.doesNotMatch(
      source,
      /allergens\.length\s*===\s*0[\s\S]*allowed:\s*true/,
    )
  },
)

test(
  'M12 never pretends captured budget or one-retailer intent is already fulfilled',
  () => {
    const source =
      readBackend(
        'src/modules/search/search.service.js',
      )

    assert.match(
      source,
      /BUDGET_REQUIRES_COMMERCE_QUOTE/,
    )

    assert.match(
      source,
      /ONE_RETAILER_REQUIRES_M11_FULFILLMENT_COMPARE/,
    )

    assert.match(
      source,
      /priceOrStockClaimed:\s*false/,
    )
  },
)

test(
  'M12 Search continuation token is hashed at rest and required for refine and explain',
  () => {
    const source =
      readBackend(
        'src/modules/search/search.service.js',
      )

    assert.match(
      source,
      /createHash\(\s*'sha256'/,
    )

    assert.match(
      source,
      /continuationTokenHash/,
    )

    assert.match(
      source,
      /SEARCH_SESSION_TOKEN_INVALID/,
    )
  },
)

test(
  'M12 Search persistence minimizes prompt-like data and reserves AI logging for later provider work',
  () => {
    const source =
      readBackend(
        'src/modules/search/search.models.js',
      )

    assert.match(
      source,
      /normalizedQuery/,
    )

    assert.match(
      source,
      /aiInteractions/,
    )

    assert.doesNotMatch(
      source,
      /rawPrompt|rawConversation|rawCardNumber|cvv/i,
    )
  },
)

test(
  'M12 frontend service exposes Search refine and decision explain APIs',
  () => {
    const source =
      readFrontend(
        'src/features/search/services/search.service.js',
      )

    assert.match(
      source,
      /apiClient\.post\(\s*'\/search'/,
    )

    assert.match(
      source,
      /apiClient\.post\(\s*'\/search\/refine'/,
    )

    assert.match(
      source,
      /apiClient\.post\(\s*'\/decision-explain'/,
    )
  },
)

test(
  'M12 P02 shows documented food-intent examples and constraint chips',
  () => {
    const source =
      readFrontend(
        'src/features/search/pages/SearchPage.jsx',
      )

    assert.match(
      source,
      /20 min me 4 logon ke liye paneer aur spinach se dinner under 800/,
    )

    assert.match(
      source,
      /buildConstraintChips/,
    )

    assert.match(
      source,
      /Why this match\?/,
    )
  },
)

test(
  'M12 P02 explicitly keeps AI optional and refuses fabricated result truth',
  () => {
    const source =
      readFrontend(
        'src/features/search/pages/SearchPage.jsx',
      )

    assert.match(
      source,
      /AI is not required for this Search to work/,
    )

    assert.match(
      source,
      /No trustworthy match found/,
    )

    assert.match(
      source,
      /no result instead of fabricating a Product, Recipe or safety claim/,
    )
  },
)

test(
  'M12 P02 composes existing P13 What Should We Cook instead of rewriting it',
  () => {
    const source =
      readFrontend(
        'src/features/search/pages/SearchPage.jsx',
      )

    assert.match(
      source,
      /\/recipes\/what-should-we-cook/,
    )

    assert.match(
      source,
      /Open What Should We Cook\?/,
    )
  },
)

test(
  'M12 app mounts Search under API v1 without moving M11 webhook behind the JSON parser',
  () => {
    const source =
      readBackend(
        'src/app.js',
      )

    assert.match(
      source,
      /import searchRoutes from '.\/modules\/search\/search\.routes\.js'/,
    )

    assert.match(
      source,
      /app\.use\(\s*'\/api\/v1',\s*searchRoutes/,
    )

    const webhookIndex =
      source.indexOf(
        'commerceWebhookRoutes',
        source.indexOf(
          'app.use(',
        ),
      )

    const jsonIndex =
      source.indexOf(
        'express.json',
      )

    assert.ok(
      webhookIndex >=
        0 &&
      jsonIndex >=
        0 &&
      webhookIndex <
        jsonIndex,
    )
  },
)