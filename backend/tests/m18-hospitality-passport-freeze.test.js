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

const projectRoot =
  path.resolve(
    __dirname,
    '..',
    '..',
  )

function readBackend(
  relativePath,
) {
  return fs.readFileSync(
    path.join(
      projectRoot,
      'backend',
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

function stripComments(source) {
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
  'M18 Batch 2 does not introduce B2B Seller Brand application capability fields or activeMode authority',
  () => {
    const source =
      stripComments(
        [
          readBackend('src/modules/hospitality/hospitality.passport.models.js'),
          readBackend('src/modules/hospitality/hospitality.passport.service.js'),
          readBackend('src/modules/hospitality/hospitality.passport.routes.js'),
          readFrontend('src/features/hospitality/pages/HospitalityPage.jsx'),
          readFrontend('src/routes/AppRoutes.jsx'),
        ].join('\n'),
      )

    for (const forbidden of [
      'b2bEnabled',
      'sellerEnabled',
      'brandEnabled',
    ]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${forbidden} must not be introduced.`,
      )
    }

    assert.doesNotMatch(
      source,
      /activeMode/,
    )
  },
)

test(
  'M18 preserves frozen Host capability authorization semantics in AppRoutes',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    assert.match(
      source,
      /hostEnabled === true && hostAccessStatus === 'active'/,
    )

    assert.match(
      source,
      /CUSTOMER:\n\s{6}['"]customer['"]/,
    )

    assert.match(
      source,
      /HOST:\n\s{6}['"]host['"]/,
    )

    assert.match(
      source,
      /SUPER_ADMIN:\n\s{6}['"]super_admin['"]/,
    )
  },
)

test(
  'M18 Hospitality routes require Host session MFA CSRF and recent MFA on writes',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.routes.js',
      )

    for (const token of [
      'authenticateSession',
      'loadCurrentUser',
      'requireActiveAccount',
      'requireHostAccess',
      'requireMfaAssurance',
      'requireCsrfToken',
      'requireRecentMfaAuthentication',
    ]) {
      assert.equal(
        source.includes(token),
        true,
        `${token} must remain wired.`,
      )
    }
  },
)

test(
  'M18 public Passport route is separate from private Host routes',
  () => {
    const app =
      readBackend(
        'src/app.js',
      )

    assert.match(
      app,
      /['"]\/api\/v1\/host\/hospitality['"]/,
    )

    assert.match(
      app,
      /['"]\/api\/v1\/dish-passports['"]/,
    )

    const routes =
      readBackend(
        'src/modules/hospitality/hospitality.passport.routes.js',
      )

    assert.match(
      routes,
      /publicRouter\.get/,
    )

    assert.match(
      routes,
      /privateRouter\.use/,
    )
  },
)

test(
  'M18 never mutates M04 M07 or M08 canonical history from Passport service',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.service.js',
      )

    for (const model of [
      'ProductVersion',
      'CanonicalIngredient',
      'Dish',
      'RecipeVersion',
      'RecipeIngredient',
      'FoodCalculation',
      'Allergen',
      'Nutrient',
    ]) {
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
  'M18 Passport and Grey Book APIs expose no content PATCH or DELETE route',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.routes.js',
      )

    assert.doesNotMatch(
      source,
      /privateRouter\.(patch|delete)\([\s\S]{0,80}dish-passports/i,
    )

    assert.doesNotMatch(
      source,
      /privateRouter\.(patch|delete)\([\s\S]{0,80}grey-books/i,
    )
  },
)

test(
  'M18 Change publish creates new history and never rewrites upstream source truth',
  () => {
    const source =
      readBackend(
        'src/modules/hospitality/hospitality.passport.service.js',
      )

    assert.match(
      source,
      /previousPassportHistoryRetained:\s*true/,
    )

    assert.match(
      source,
      /previousGreyBookHistoryRetained:\s*true/,
    )

    assert.match(
      source,
      /automaticSourceMutation:\s*false/,
    )
  },
)

test(
  'M18 HostShell preserves frozen Orders label while adding Hospitality entry',
  () => {
    const source =
      readFrontend(
        'src/features/host/components/HostShell.jsx',
      )

    assert.match(
      source,
      /label:\s*['"]Orders['"]/,
    )

    assert.match(
      source,
      /screenLabel:\s*['"]S06 Orders['"]/,
    )

    assert.match(
      source,
      /screenLabel:\s*['"]Hospitality \/ Pro Ops['"]/,
    )
  },
)

test(
  'M18 AppRoutes exposes all B01-B11 Host routes behind Host access',
  () => {
    const source =
      readFrontend(
        'src/routes/AppRoutes.jsx',
      )

    for (const route of [
      '/host/hospitality',
      '/host/hospitality/outlets',
      '/host/hospitality/suppliers',
      '/host/hospitality/products',
      '/host/hospitality/recipes',
      '/host/hospitality/menus',
      '/host/hospitality/procurement',
      '/host/hospitality/costing',
      '/host/hospitality/dish-passports',
      '/host/hospitality/grey-book',
      '/host/hospitality/change-management',
    ]) {
      assert.equal(
        source.includes(
          `path="${route}"`,
        ),
        true,
        `${route} must remain wired.`,
      )
    }

    assert.match(
      source,
      /function HospitalityRoute/,
    )

    assert.match(
      source,
      /APPLICATION_ACCESS_TYPES\.HOST/,
    )
  },
)

test(
  'M18 preserves M11 raw Razorpay webhook before global JSON parser',
  () => {
    const source =
      readBackend(
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
      webhookIndex >= 0,
    )

    assert.ok(
      jsonIndex >
      webhookIndex,
    )
  },
)