import mongoose from 'mongoose'

import brands from '../seed-data/brands.js'

import internationalBrands from '../seed-data/internationalBrands.js'

import internationalProducts from '../seed-data/internationalProducts.js'

import products from '../seed-data/products.js'

import recipes from '../seed-data/recipes.js'

import {
  connectDatabase,
  disconnectDatabase,
} from '../src/config/db.js'

import {
  env,
} from '../src/config/env.js'

import {
  seedCanonicalCatalog,
} from '../src/modules/catalog/catalog.seed.js'

if (!env.allowSeed) {
  console.error(
    'Seed blocked. Set ALLOW_SEED=true only in local or staging environments.',
  )

  process.exit(1)
}

if (
  env.nodeEnv ===
  'production'
) {
  console.error(
    'Seed blocked in production.',
  )

  process.exit(1)
}

/*
|--------------------------------------------------------------------------
| Catalog
|--------------------------------------------------------------------------
*/

const allBrands = [
  ...brands,
  ...internationalBrands,
]

const allProducts = [
  ...products,
  ...internationalProducts,
]

/*
|--------------------------------------------------------------------------
| Feature Flags
|--------------------------------------------------------------------------
*/

const featureFlags = [
  {
    key:
      'grocery',

    enabled:
      true,

    description:
      'Grocery module',
  },

  {
    key:
      'brands',

    enabled:
      true,

    description:
      'Brands module',
  },

  {
    key:
      'recipes',

    enabled:
      true,

    description:
      'Recipes module',
  },

  {
    key:
      'aiCopilot',

    enabled:
      false,

    description:
      'Future AI Copilot module',
  },

  {
    key:
      'pantry',

    enabled:
      false,

    description:
      'Future Living Pantry module',
  },

  {
    key:
      'checkout',

    enabled:
      false,

    description:
      'Future checkout module',
  },
]

/*
|--------------------------------------------------------------------------
| Generic Legacy Seed Upsert
|--------------------------------------------------------------------------
|
| Legacy M01 product/recipe collections remain during the M04 transition.
|
| M04's public Grocery API does NOT read the legacy products collection.
|
*/

async function upsertLegacySeedCollection(
  name,
  items,
) {
  const collection =
    mongoose.connection.collection(
      name,
    )

  if (!items.length) {
    return
  }

  await collection.bulkWrite(
    items.map(
      (item) => ({
        updateOne: {
          filter: {
            id:
              item.id,
          },

          update: {
            $set: {
              ...item,

              seedSource:
                'development_seed',

              seedVersion:
                'm01',
            },
          },

          upsert:
            true,
        },
      }),
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Legacy Brand Compatibility
|--------------------------------------------------------------------------
|
| `brands` is now also the canonical M04 Brand collection.
|
| Brand upserts therefore use slug rather than legacy id so an already-created
| canonical Brand cannot be duplicated by a later development seed.
|
| Existing M01 fields remain temporarily for old frontend compatibility.
|
*/

async function upsertLegacyBrands(
  items,
) {
  const collection =
    mongoose.connection.collection(
      'brands',
    )

  if (!items.length) {
    return
  }

  await collection.bulkWrite(
    items.map(
      (item) => ({
        updateOne: {
          filter: {
            slug:
              item.slug,
          },

          update: {
            $set: {
              ...item,

              seedSource:
                'development_seed',

              seedVersion:
                'm01',
            },
          },

          upsert:
            true,
        },
      }),
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Development Super Admin Promotion
|--------------------------------------------------------------------------
|
| Super Admin is not a public registration type.
|
| The seed must never create an incomplete authentication identity.
|
| If SEED_SUPER_ADMIN_EMAIL is configured, the corresponding user must already
| exist through the normal Firebase + Mongo registration/login identity flow.
|
| This development-only operation then grants explicit Super Admin access to
| that existing identity.
|
| Existing Customer / Host capabilities are not modified here. Super Admin
| remains a separate privileged capability and is not inferred from activeMode.
|
*/

async function promoteDevelopmentSuperAdmin() {
  if (
    !env.seedSuperAdminEmail
  ) {
    return {
      configured:
        false,

      promoted:
        false,
    }
  }

  const normalizedEmail =
    env.seedSuperAdminEmail
      .trim()
      .toLowerCase()

  const usersCollection =
    mongoose.connection.collection(
      'users',
    )

  const user =
    await usersCollection.findOne(
      {
        email:
          normalizedEmail,
      },

      {
        projection: {
          _id:
            1,

          firebaseUid:
            1,

          email:
            1,

          accountStatus:
            1,

          customerEnabled:
            1,

          hostEnabled:
            1,

          hostAccessStatus:
            1,

          superAdminEnabled:
            1,

          activeMode:
            1,
        },
      },
    )

  if (!user) {
    console.warn(
      `Super Admin seed skipped: no existing EPANTRY user was found for ${normalizedEmail}. Register the identity normally first, then re-run the development seed.`,
    )

    return {
      configured:
        true,

      promoted:
        false,
    }
  }

  if (
    !user.firebaseUid
  ) {
    console.warn(
      `Super Admin seed skipped: ${normalizedEmail} does not have a Firebase-linked identity. Complete the normal authentication registration flow first.`,
    )

    return {
      configured:
        true,

      promoted:
        false,
    }
  }

  await usersCollection.updateOne(
    {
      _id:
        user._id,

      email:
        normalizedEmail,

      firebaseUid:
        user.firebaseUid,
    },

    {
      $set: {
        superAdminEnabled:
          true,
      },

      $unset: {
        roles:
          '',

        accountType:
          '',

        status:
          '',

        authReady:
          '',
      },
    },
  )

  console.log(
    `Development Super Admin access enabled for ${normalizedEmail}.`,
  )

  return {
    configured:
      true,

    promoted:
      true,
  }
}

/*
|--------------------------------------------------------------------------
| Seed
|--------------------------------------------------------------------------
*/

try {
  await connectDatabase()

  /*
  |--------------------------------------------------------------------------
  | Legacy M01 Compatibility Data
  |--------------------------------------------------------------------------
  */

  await upsertLegacySeedCollection(
    'products',
    allProducts,
  )

  await upsertLegacyBrands(
    allBrands,
  )

  await upsertLegacySeedCollection(
    'recipes',
    recipes,
  )

  /*
  |--------------------------------------------------------------------------
  | M04 Canonical Grocery Catalog
  |--------------------------------------------------------------------------
  */

  const canonicalCatalog =
    await seedCanonicalCatalog({
      brands:
        allBrands,

      products:
        allProducts,
    })

  /*
  |--------------------------------------------------------------------------
  | Feature Flags
  |--------------------------------------------------------------------------
  */

  await mongoose.connection
    .collection(
      'featureFlags',
    )
    .bulkWrite(
      featureFlags.map(
        (flag) => ({
          updateOne: {
            filter: {
              key:
                flag.key,
            },

            update: {
              $set: {
                ...flag,

                seedSource:
                  'm01',
              },
            },

            upsert:
              true,
          },
        }),
      ),
    )

  /*
  |--------------------------------------------------------------------------
  | Development Super Admin
  |--------------------------------------------------------------------------
  */

  const superAdminSeed =
    await promoteDevelopmentSuperAdmin()

  /*
  |--------------------------------------------------------------------------
  | System Seed Audit
  |--------------------------------------------------------------------------
  */

  await mongoose.connection
    .collection(
      'auditEvents',
    )
    .insertOne({
      type:
        'system.seed.completed',

      source:
        'm04',

      occurredAt:
        new Date(),

      counts: {
        legacyProducts:
          allProducts.length,

        brands:
          allBrands.length,

        recipes:
          recipes.length,

        featureFlags:
          featureFlags.length,

        canonicalProducts:
          canonicalCatalog
            .productsProcessed,

        canonicalCategories:
          canonicalCatalog
            .categoriesProcessed,

        productVersionsCreated:
          canonicalCatalog
            .productVersionsCreated,

        productVersionsExisting:
          canonicalCatalog
            .productVersionsExisting,

        evidenceSourcesCreated:
          canonicalCatalog
            .evidenceSourcesCreated,

        evidenceSourcesExisting:
          canonicalCatalog
            .evidenceSourcesExisting,
      },

      superAdmin: {
        configured:
          superAdminSeed.configured,

        promoted:
          superAdminSeed.promoted,
      },
    })

  console.log(
    `Legacy seed complete: ${allProducts.length} products, ${allBrands.length} brands, ${recipes.length} recipes, ${featureFlags.length} feature flags.`,
  )

  console.log(
    `M04 canonical catalog: ${canonicalCatalog.productsProcessed} products processed, ${canonicalCatalog.categoriesProcessed} categories, ${canonicalCatalog.productVersionsCreated} versions created, ${canonicalCatalog.productVersionsExisting} existing versions preserved.`,
  )

  console.log(
    `M04 evidence: ${canonicalCatalog.evidenceSourcesCreated} created, ${canonicalCatalog.evidenceSourcesExisting} existing.`,
  )
} catch (error) {
  console.error(
    `Seed failed: ${error.message}`,
  )

  process.exitCode =
    1
} finally {
  await disconnectDatabase()
}