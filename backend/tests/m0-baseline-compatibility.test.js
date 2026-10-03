import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here =
  path.dirname(
    fileURLToPath(
      import.meta.url,
    ),
  )

const projectRoot =
  path.resolve(
    here,
    '..',
    '..',
  )

function read(
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

function readDirectory(
  relativePath,
) {
  const directory =
    path.join(
      projectRoot,
      relativePath,
    )

  return fs
    .readdirSync(
      directory,
      {
        withFileTypes:
          true,
      },
    )
    .filter(
      (entry) =>
        entry.isFile(),
    )
    .map(
      (entry) =>
        ({
          name:
            entry.name,

          source:
            fs.readFileSync(
              path.join(
                directory,
                entry.name,
              ),
              'utf8',
            ),
        }),
    )
}

test(
  'M0 preserves the three top-level access capabilities and Customer-Host mode switch foundation',
  () => {
    const userModel =
      read(
        'backend/src/modules/users/user.model.js',
      )

    for (const field of [
      'customerEnabled',
      'hostEnabled',
      'superAdminEnabled',
      'hostAccessStatus',
    ]) {
      assert.equal(
        userModel.includes(
          field,
        ),
        true,
        `${field} must remain part of the access foundation.`,
      )
    }

    const routes =
      read(
        'frontend/src/routes/AppRoutes.jsx',
      )

    for (const accessType of [
      'APPLICATION_ACCESS_TYPES.CUSTOMER',
      'APPLICATION_ACCESS_TYPES.HOST',
      'APPLICATION_ACCESS_TYPES.SUPER_ADMIN',
    ]) {
      assert.equal(
        routes.includes(
          accessType,
        ),
        true,
        `${accessType} must remain routed.`,
      )
    }

    const switcher =
      read(
        'frontend/src/features/auth/components/ModeSwitcher.jsx',
      )

    assert.match(
      switcher,
      /switchMode\(targetMode\)/,
    )

    assert.match(
      switcher,
      /['"]\/host\/operations['"]/,
    )

    assert.match(
      switcher,
      /['"]\/dashboard['"]/,
    )
  },
)

test(
  'M0 freezes route compatibility anchors so later ownership changes cannot create dead bookmarks',
  () => {
    const routes =
      read(
        'frontend/src/routes/AppRoutes.jsx',
      )

    const compatibilityRoutes = [
      '/recipes',
      '/community',
      '/creator-studio',
      '/learn',
      '/notifications',
      '/host/brand-recipes',
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
      '/admin/host-operations',
    ]

    for (const route of compatibilityRoutes) {
      assert.equal(
        routes.includes(
          `path="${route}"`,
        ),
        true,
        `${route} must stay routable or become an explicit compatibility redirect in a later module.`,
      )
    }

    assert.match(
      routes,
      /path="\/dish-passports\/:publicId"/,
    )
  },
)

test(
  'M0 preserves the official public recipe publication contract',
  () => {
    const publicRecipes =
      read(
        'backend/src/modules/recipes/recipe.public.service.js',
      )

    assert.match(
      publicRecipes,
      /status:\s*['"]published['"]/,
    )

    assert.match(
      publicRecipes,
      /status:\s*['"]active['"]/,
    )

    assert.match(
      publicRecipes,
      /RecipeVersion\.find/,
    )

    assert.match(
      publicRecipes,
      /Dish\.find/,
    )
  },
)

test(
  'M0 preserves Razorpay checkout and raw webhook ordering',
  () => {
    const checkout =
      read(
        'frontend/src/features/commerce/pages/CheckoutPage.jsx',
      )

    assert.match(
      checkout,
      /https:\/\/checkout\.razorpay\.com\/v1\/checkout\.js/,
    )

    const provider =
      read(
        'backend/src/modules/commerce/commerce.payment.provider.js',
      )

    for (const key of [
      'RAZORPAY_BASE_URL',
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
    ]) {
      assert.equal(
        provider.includes(
          key,
        ),
        true,
        `${key} must remain part of the payment boundary.`,
      )
    }

    const app =
      read(
        'backend/src/app.js',
      )

    const webhookIndex =
      app.indexOf(
        "'/api/v1/webhooks'",
      )

    const jsonIndex =
      app.indexOf(
        'express.json',
      )

    assert.ok(
      webhookIndex >= 0,
    )

    assert.ok(
      jsonIndex > webhookIndex,
    )
  },
)

test(
  'M0 preserves approval notifications and safe deep-link navigation',
  () => {
    const notificationService =
      read(
        'backend/src/modules/notifications/notification.service.js',
      )

    assert.match(
      notificationService,
      /hospitality_approval_requested/,
    )

    assert.match(
      notificationService,
      /['"]\/admin\/host-operations['"]/,
    )

    const notificationCenter =
      read(
        'frontend/src/features/notifications/pages/NotificationCenterPage.jsx',
      )

    assert.match(
      notificationCenter,
      /notification\?\.deepLink\?\.path/,
    )

    assert.match(
      notificationCenter,
      /startsWith\("\/"\)/,
    )
  },
)

test(
  'M0 preserves Super Admin governance for Hospitality approvals',
  () => {
    const hospitality =
      read(
        'backend/src/modules/hospitality/hospitality.service.js',
      )

    assert.match(
      hospitality,
      /approveHospitalityProductionRecipeAsSuperAdmin/,
    )

    assert.match(
      hospitality,
      /HOSPITALITY_SUPER_ADMIN_APPROVAL_REQUIRED/,
    )

    assert.match(
      hospitality,
      /notifyActiveSuperAdminsBestEffort/,
    )

    const passport =
      read(
        'backend/src/modules/hospitality/hospitality.passport.service.js',
      )

    assert.match(
      passport,
      /rootSuperAdminActorId/,
    )

    assert.match(
      passport,
      /notifyActiveSuperAdminsBestEffort/,
    )
  },
)

test(
  'M0 captures the current cross-domain relationship anchors without deleting legacy models',
  () => {
    const relationships = [
      [
        'backend/src/modules/recipes/recipe.models.js',
        [
          'dishId',
          'recipeVersionId',
        ],
      ],
      [
        'backend/src/modules/community/community.models.js',
        [
          'recipeVersionId',
          'creatorUserId',
          'visibility',
        ],
      ],
      [
        'backend/src/modules/hospitality/hospitality.models.js',
        [
          'organizationId',
          'sourceRecipeVersionId',
          'productionRecipeVersionId',
        ],
      ],
      [
        'backend/src/modules/learning/learning.models.js',
        [
          'userId',
          'courseId',
        ],
      ],
      [
        'backend/src/modules/notifications/notification.models.js',
        [
          'userId',
          'relatedEntityId',
          'dedupeKey',
        ],
      ],
      [
        'backend/src/modules/hostOperations/hostOperations.models.js',
        [
          'organizationType',
          'organizationId',
          'userId',
        ],
      ],
    ]

    for (const [
      file,
      fields,
    ] of relationships) {
      const source =
        read(
          file,
        )

      for (const field of fields) {
        assert.equal(
          source.includes(
            field,
          ),
          true,
          `${file} must retain ${field} until a later additive migration explicitly supersedes it.`,
        )
      }
    }
  },
)

test(
  'M0 migration safety forbids destructive database or collection drops in migration scripts',
  () => {
    const migrations =
      readDirectory(
        'backend/scripts',
      ).filter(
        (file) =>
          file.name.startsWith(
            'migrate-',
          ) &&
          file.name.endsWith(
            '.mjs',
          ),
      )

    assert.ok(
      migrations.length > 0,
    )

    for (const migration of migrations) {
      assert.doesNotMatch(
        migration.source,
        /\.dropDatabase\s*\(/,
        `${migration.name} must not drop the database.`,
      )

      assert.doesNotMatch(
        migration.source,
        /\.dropCollection\s*\(/,
        `${migration.name} must not drop a collection.`,
      )

      assert.doesNotMatch(
        migration.source,
        /\.deleteMany\s*\(\s*\{\s*\}\s*\)/,
        `${migration.name} must not blanket-delete a collection.`,
      )
    }
  },
)

test(
  'M0 keeps approved Host visual shell anchors available for later regression comparison',
  () => {
    const hostShell =
      read(
        'frontend/src/features/host/components/HostShell.jsx',
      )

    for (const token of [
      'bg-[#faf8f4]',
      'bg-[linear-gradient(145deg,#17483b_0%,#11382f_100%)]',
      'Hospitality Operations',
      'Recipe Listings',
      'Orders',
    ]) {
      assert.equal(
        hostShell.includes(
          token,
        ),
        true,
        `${token} is part of the current approved Host shell baseline.`,
      )
    }

    const hospitalityPage =
      read(
        'frontend/src/features/hospitality/pages/HospitalityPage.jsx',
      )

    for (const token of [
      'Purchasing',
      'Kitchen recipes',
      'Outlet menus',
      'Dish records',
    ]) {
      assert.equal(
        hospitalityPage.includes(
          token,
        ),
        true,
        `${token} must remain represented while Hospitality is reorganized.`,
      )
    }
  },
)
